odoo.define('pos_retail.big_data', function (require) {
    var core = require('web.core');
    var _t = core._t;
    var rpc = require('pos.rpc');
    var db = require('point_of_sale.DB');
    var screens = require('point_of_sale.screens');
    var models = require('point_of_sale.models');
    var indexed_db = require('pos_retail.indexedDB');
    var chrome = require('point_of_sale.chrome');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var QWeb = core.qweb;
    var exports = {};
    var Backbone = window.Backbone;
    var bus = require('pos_retail.core_bus');
    var RetailModel = require('pos_retail.model');
    var field_utils = require('web.field_utils');

    var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;

    if (!indexedDB) {
        window.alert("Your browser doesn't support a stable version of IndexedDB.")
    }

    exports.pos_sync_backend = Backbone.Model.extend({
        initialize: function (pos) {
            this.pos = pos;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.last = this.pos.db.load('bus_last', 0);
            this.bus.on("notification", this, this.on_notification);
            this.bus.start_polling();
        },
        on_notification: function (notifications) {
            if (notifications && notifications[0] && notifications[0][1]) {
                for (var i = 0; i < notifications.length; i++) {
                    var channel = notifications[i][0][1];
                    if (channel == 'pos.sync.backend') {
                        var model = notifications[i][1].model;
                        var id = notifications[i][1].id;
                        this.pos.get_data_by_id(model, id)
                    }
                }
            }
        }
    });

    screens.ProductScreenWidget.include({
        remove_product_out_of_screen: function (product) {
            if (this.pos.session.server_version_info[0] != 10) {
                var current_pricelist = this.product_list_widget._get_active_pricelist();
                var cache_key = this.product_list_widget.calculate_cache_key(product, current_pricelist);
                this.product_list_widget.product_cache.cache_node(cache_key, null);
                var contents = document.querySelector(".product-list " + "[data-product-id='" + product['id'] + "']");
                if (contents) {
                    contents.replaceWith()
                }
            }
        },
        do_update_products_cache: function (product_datas) {
            if (this.pos.session.server_version_info[0] == 10) {
                this.pos.db.add_products(product_datas);
                for (var i = 0; i < product_datas.length; i++) {
                    var product = product_datas[i];
                    if (this.pos.db.stock_datas && this.pos.db.stock_datas[product['id']]) {
                        product['qty_available'] = this.pos.db.stock_datas[product['id']];
                    }
                    this.product_list_widget.product_cache.cache_node(product['id'], null);
                    var product_node = this.product_list_widget.render_product(product);
                    product_node.addEventListener('click', this.product_list_widget.click_product_handler);
                    var $product_el = $(".product-list " + "[data-product-id='" + product['id'] + "']");
                    if ($product_el.length > 0) {
                        $product_el.replaceWith(product_node);
                    }
                }
            } else {
                var self = this;
                this.pos.db.add_products(_.map(product_datas, function (product) {
                    var using_company_currency = self.pos.config.currency_id[0] === self.pos.company.currency_id[0];
                    if (self.pos.company_currency) {
                        var conversion_rate = self.pos.currency.rate / self.pos.company_currency.rate;
                    } else {
                        var conversion_rate = 1;
                    }
                    if (!using_company_currency) {
                        product['lst_price'] = round_pr(product.lst_price * conversion_rate, self.pos.currency.rounding);
                    }
                    if (self.pos.db.stock_datas && self.pos.db.stock_datas[product['id']]) {
                        product['qty_available'] = self.pos.db.stock_datas[product['id']];
                    }
                    product['categ'] = _.findWhere(self.pos.product_categories, {'id': product['categ_id'][0]});
                    product = new models.Product({}, product);
                    var current_pricelist = self.product_list_widget._get_active_pricelist();
                    var cache_key = self.product_list_widget.calculate_cache_key(product, current_pricelist);
                    self.product_list_widget.product_cache.cache_node(cache_key, null);
                    var product_node = self.product_list_widget.render_product(product);
                    product_node.addEventListener('click', self.product_list_widget.click_product_handler);
                    var contents = document.querySelector(".product-list " + "[data-product-id='" + product['id'] + "']");
                    if (contents) {
                        contents.replaceWith(product_node)
                    }
                    document.querySelector('.product-list').appendChild(product_node);
                    return product;
                }));
            }
        },
    });

    screens.ClientListScreenWidget.include({
        do_update_partners_cache: function (partners) {
            var contents = this.$el[0].querySelector('.client-list-contents');
            var client_selected = this.new_client;
            if (client_selected) {
                this.display_client_details('hide', client_selected);
                this.new_client = null;
                this.toggle_save_button();
            }
            for (var i = 0; i < partners.length; i++) {
                var partner = partners[i];
                var clientline_html = QWeb.render('ClientLine', {widget: this, partner: partners[i]});
                clientline = document.createElement('tbody');
                clientline.innerHTML = clientline_html;
                clientline = clientline.childNodes[1];
                this.partner_cache.cache_node(partner.id, clientline);
                contents.appendChild(clientline);
            }
        }
    });

    var sync_backend_status = chrome.StatusWidget.extend({
        template: 'sync_backend_status',
        start: function () {
            var self = this;
            this.pos.bind('change:sync_backend', function (pos, sync_backend) {
                self.set_status(sync_backend.state, sync_backend.pending);
            });
            this.$el.click(function () {
                var status = new $.Deferred();
                self.pos._auto_refresh_products();
                self.pos._auto_refresh_partners();
                self.pos.get_modifiers_backend_all_models().then(function (total_sync) {
                    self.pos.set('sync_backend', {state: 'connected', pending: 0});
                    self.pos.gui.show_popup('dialog', {
                        title: 'Great Job !',
                        body: 'Have ' + total_sync + ' news from backend, database pos now updated succeed',
                        color: 'success'
                    });
                    status.resolve()
                }, function (err) {
                    self.pos.query_backend_fail(err);
                    status.reject(err)
                });
                return status;
            });
        },
    });

    chrome.Chrome.include({
        build_widgets: function () {
            this.widgets.push(
                {
                    'name': 'sync_backend_status',
                    'widget': sync_backend_status,
                    'append': '.pos-branding'
                }
            );
            this._super();
        }
    });

    db.include({
        init: function (options) {
            this._super(options);
            this.write_date_by_model = {};
        },
        set_last_write_date_by_model: function (model, results) {
            /*
                We need to know last records updated (change by backend clients)
                And use field write_date compare datas of pos and datas of backend
                We are get best of write date and compare
             */
            for (var i = 0; i < results.length; i++) {
                var line = results[i];
                if (!this.write_date_by_model[model]) {
                    this.write_date_by_model[model] = line.write_date;
                    continue;
                }
                if (this.write_date_by_model[model] != line.write_date && new Date(this.write_date_by_model[model]).getTime() < new Date(line.write_date).getTime()) {
                    this.write_date_by_model[model] = line.write_date;
                }
            }
        },
        filter_datas_notifications_with_current_date: function (model, datas) {
            var self = this;
            var new_datas = _.filter(datas, function (data) {
                return new Date(self.write_date_by_model[data['model']]).getTime() <= new Date(data['write_date']).getTime() + 1000;
            });
            return new_datas;
        },
    });
    models.load_models([
        {
            label: 'fields and domain products, customers',
            loaded: function (self) {
                var save_status = new $.Deferred();
                var models = {};
                for (var number in self.model_lock) {
                    var model = self.model_lock[number];
                    models[model['model']] = {
                        fields: model['fields'] || [],
                        domain: model['domain'] || [],
                        context: model['context'] || [],
                    };
                    if (model['model'] == 'res.partner') {
                        models[model['model']]['domain'] = []
                    }
                }
                rpc.query({
                    model: 'pos.cache.database',
                    method: 'save_parameter_models_load',
                    args: [[], models]
                }).then(function (reinstall) {
                    save_status.resolve(reinstall);
                    if (reinstall) {
                        self.remove_indexed_db();
                    }
                }, function (error) {
                    self.reload_pos();
                    save_status.reject(error);
                });
                return save_status;
            },
        }
    ], {
        before: 'res.company'
    });
    models.load_models([
        {
            label: 'Reinstall pos database',
            condition: function (self) {
                return self.config.required_reinstall_cache;
            },
            loaded: function (self) {
                var save_status = new $.Deferred();
                return rpc.query({
                    model: 'pos.config',
                    method: 'update_required_reinstall_cache',
                    args: [[self.config.id]]
                }).then(function (state) {
                    save_status.resolve(state);
                    self.remove_indexed_db();
                }, function (error) {
                    self.remove_indexed_db();
                    save_status.reject(error);
                });
                return save_status;
            },
        },
    ], {
        after: 'pos.config'
    });
    models.load_models([
        {
            label: 'products',
            loaded: function (self) {
                var status = new $.Deferred();
                $.when(indexed_db.get_products(self, self.session.model_ids['product.product']['max_id'] / 100000 + 1)).done(function () {
                    status.resolve()
                });
                return status;
            },
        },
        {
            label: 'partners',
            loaded: function (self) {
                var status = new $.Deferred();
                $.when(indexed_db.get_clients(self, self.session.model_ids['res.partner']['max_id'] / 100000 + 1)).done(function () {
                    status.resolve()
                });
                return status;
            },
        }, {
            model: 'pos.order',
            condition: function (self) {
                return self.config.pos_orders_management;
            },
            fields: [
                'create_date',
                'name',
                'date_order',
                'user_id',
                'amount_tax',
                'amount_total',
                'amount_paid',
                'amount_return',
                'pricelist_id',
                'partner_id',
                'sequence_number',
                'session_id',
                'state',
                'invoice_id',
                'picking_id',
                'picking_type_id',
                'location_id',
                'note',
                'nb_print',
                'pos_reference',
                'sale_journal',
                'fiscal_position_id',
                'ean13',
                'expire_date',
                'is_return',
                'voucher_id',
                'email',
                'sale_id',
                'write_date',
                'config_id',
            ],
            domain: function (self) {
                var domain = [];
                domain.push(self._get_domain_by_pos_order_period_return_days());
                if (self.config.pos_orders_load_all) {
                    return domain
                } else {
                    domain.push(['config_id', '=', self.config.id])
                }
                return domain;
            },
            loaded: function (self, orders) {
                self.order_ids = [];
                for (var i = 0; i < orders.length; i++) {
                    var order = orders[i];
                    var create_date = field_utils.parse.datetime(order.create_date);
                    order.create_date = field_utils.format.datetime(create_date);
                    var date_order =  field_utils.parse.datetime(order.date_order);
                    order.date_order = field_utils.format.datetime(date_order);
                    self.order_ids.push(order.id)
                }
                self.db.save_pos_orders(orders);
            },
            retail: true,
        }, {
            model: 'pos.order.line',
            fields: [
                'name',
                'notice',
                'product_id',
                'price_unit',
                'qty',
                'price_subtotal',
                'price_subtotal_incl',
                'discount',
                'order_id',
                'plus_point',
                'redeem_point',
                'promotion',
                'promotion_reason',
                'is_return',
                'uom_id',
                'user_id',
                'note',
                'discount_reason',
                'create_uid',
                'write_date',
                'create_date',
                'config_id',
                'combo_item_ids',
                'variant_ids',
            ],
            domain: function (self) {
                return [['order_id', 'in', self.order_ids]]
            },
            condition: function (self) {
                return self.config.pos_orders_management;
            },
            loaded: function (self, order_lines) {
                var order_lines = _.filter(order_lines, function (line) {
                    return (!line.config_id || line.config_id[0] == self.config.id);
                });
                self.db.save_pos_order_line(order_lines);
            },
            retail: true,
        }, {
            model: 'account.invoice',
            condition: function (self) {
                return self.config.management_invoice;
            },
            fields: [
                'create_date',
                'partner_id',
                'origin',
                'number',
                'payment_term_id',
                'date_invoice',
                'state',
                'residual',
                'amount_tax',
                'amount_total',
                'type',
                'write_date'
            ],
            domain: function (self) {
                var domain = [];
                if (!self.config.load_invoice_paid) {
                    domain.push(['state', 'not in', ['paid', 'cancel']])
                } else {
                    domain.push(['state', '!=', 'cancel'])
                }
                return domain;
            },
            context: {'pos': true},
            loaded: function (self, invoices) {
                self.invoice_ids = [];
                for (var i = 0; i < invoices.length; i++) {
                    self.invoice_ids.push(invoices[i]['id']);
                }
                self.db.save_invoices(invoices);
            },
            retail: true,
        },
        {
            model: 'account.invoice.line',
            condition: function (self) {
                return self.config.management_invoice;
            },
            fields: [
                'invoice_id',
                'uom_id',
                'product_id',
                'price_unit',
                'price_subtotal',
                'quantity',
                'discount',
                'write_date'
            ],
            domain: function (self) {
                return [['invoice_id', 'in', self.invoice_ids]]
            },
            context: {'pos': true},
            loaded: function (self, invoice_lines) {
                self.db.save_invoice_lines(invoice_lines);
            },
            retail: true,
        },
        {
            model: 'sale.order',
            fields: [
                'create_date',
                'name',
                'origin',
                'client_order_ref',
                'state',
                'date_order',
                'validity_date',
                'confirmation_date',
                'user_id',
                'partner_id',
                'partner_invoice_id',
                'partner_shipping_id',
                'invoice_status',
                'payment_term_id',
                'note',
                'amount_tax',
                'amount_total',
                'picking_ids',
                'delivery_address',
                'delivery_date',
                'delivery_phone',
                'book_order',
                'payment_partial_amount',
                'payment_partial_journal_id',
                'write_date',
                'ean13',
            ],
            domain: function (self) {
                var domain = [['state', '!=', 'done']];
                return domain;
            },
            condition: function (self) {
                return self.config.booking_orders;
            },
            context: {'pos': true},
            loaded: function (self, orders) {
                self.booking_ids = [];
                for (var i = 0; i < orders.length; i++) {
                    self.booking_ids.push(orders[i].id)
                }
                self.db.save_sale_orders(orders);
            },
            retail: true,
        }, {
            model: 'sale.order.line',
            fields: [
                'name',
                'discount',
                'product_id',
                'order_id',
                'price_unit',
                'price_subtotal',
                'price_tax',
                'price_total',
                'product_uom',
                'product_uom_qty',
                'qty_delivered',
                'qty_invoiced',
                'tax_id',
                'variant_ids',
                'state',
                'write_date'
            ],
            domain: function (self) {
                return [['order_id', 'in', self.booking_ids]]
            },
            condition: function (self) {
                return self.config.booking_orders;
            },
            context: {'pos': true},
            loaded: function (self, order_lines) {
                self.order_lines = order_lines;
                self.db.save_sale_order_lines(order_lines);
            },
            retail: true,
        },
    ]);

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        set_client: function (client) {
            if (client && client['id'] && this.pos.deleted['res.partner'] && this.pos.deleted['res.partner'].indexOf(client['id']) != -1) {
                client = null;
                return this.pos.gui.show_popup('confirm', {
                    title: 'Blocked action',
                    body: 'This client deleted from backend'
                })
            }
            _super_Order.set_client.apply(this, arguments);
        },
    });
    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        // TODO: sync backend
        query_backend_fail: function (error) {
            if (error && error.code === 200 && error.data && error.data.message) {
                return this.gui.show_popup('error', {
                    title: error.message,
                    body: error.data.message,
                })
            } else {
                return this.gui.show_popup('error', {
                    title: 'Error',
                    body: 'Odoo Offline mode or Backend Code have issues. Please contact your admin system',
                })
            }
        },
        update_products_in_cart: function (product_datas) {
            var orders = this.get('orders').models;
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                for (j = 0; j < product_datas.length; j++) {
                    var product = product_datas[j];
                    var lines_the_same_product = _.filter(order.orderlines.models, function (line) {
                        return line.product.id == product.id
                    });
                    if (!lines_the_same_product) {
                        continue
                    } else {
                        for (n = 0; n < lines_the_same_product.length; n++) {
                            lines_the_same_product[n].product = this.db.get_product_by_id(product['id']);
                            lines_the_same_product[n].trigger('change', lines_the_same_product[n])
                        }
                    }
                }
            }
        },
        update_customer_in_cart: function (partner_datas) {
            var orders = this.get('orders').models;
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                var client_order = order.get_client();
                if (!client_order || order.finalized) {
                    continue
                }
                for (var n = 0; n < partner_datas.length; n++) {
                    var partner_data = partner_datas[n];
                    if (partner_data['id'] == client_order.id) {
                        var client = this.db.get_partner_by_id(client_order.id);
                        order.set_client(client);
                    }
                }
            }
        },
        sync_with_backend: function (model, datas, dont_check_write_time) {
            if (datas.length == 0) {
                console.warn('Data sync is old times. Reject:' + model);
                return false;
            }
            this.db.set_last_write_date_by_model(model, datas);
            if (model == 'pos.order') {
                this.db.save_pos_orders(datas);
            }
            if (model == 'pos.order.line') {
                this.db.save_pos_order_line(datas);
            }
            if (model == 'account.invoice') {
                this.db.save_invoices(datas);
            }
            if (model == 'account.invoice.line') {
                this.db.save_invoice_lines(datas);
            }
            if (model == 'sale.order') {
                this.db.save_sale_orders(datas);
                var order = datas[0];
                if (!order.deleted && order.state != 'done' && this.config.booking_orders_alert)
                    this.trigger('new:booking_order', order['id']);
            }
            if (model == 'sale.order.line') {
                this.db.save_sale_order_lines(datas);
            }
            if (model == 'res.partner') {
                var partner_datas = _.filter(datas, function (partner) {
                    return !partner.deleted || partner.deleted != true
                });
                if (partner_datas.length) {
                    this.db.add_partners(partner_datas);
                    if (this.gui.screen_instances && this.gui.screen_instances['clientlist']) {
                        this.gui.screen_instances["clientlist"].do_update_partners_cache(partner_datas);
                    }
                    this.update_customer_in_cart(partner_datas);
                }
            }
            if (model == 'product.product') {
                var product_datas = _.filter(datas, function (product) {
                    return !product.deleted || product.deleted != true
                });
                if (product_datas.length) {
                    if (this.gui.screen_instances && this.gui.screen_instances['products']) {
                        this.gui.screen_instances["products"].do_update_products_cache(product_datas);
                    }
                    this.update_products_in_cart(product_datas);
                }
            }
            if (model == 'product.product' || model == 'res.partner') {
                for (var i = 0; i < datas.length; i++) {
                    var data = datas[i];
                    if (!data['deleted'] || data['deleted'] == false) {
                        indexed_db.write(model, [data]);
                    } else {
                        indexed_db.unlink(model, data);
                        if (model == 'res.partner') {
                            this.remove_partner_deleted_outof_orders(data['id'])
                        }
                        if (model == 'product.product' && this.gui.screen_instances["products"]) {
                            this.remove_product_deleted_outof_orders(data['id']);
                            this.gui.screen_instances["products"].remove_product_out_of_screen(data);
                        }
                    }
                }
            }
            this.set('sync_backend', {state: 'connected', pending: 0});
        },
        remove_partner_deleted_outof_orders: function (partner_id) {
            var orders = this.get('orders').models;
            var order = orders.find(function (order) {
                var client = order.get_client();
                if (client && client['id'] == partner_id) {
                    return true;
                }
            });
            if (order) {
                order.set_client(null)
            }
            return order;
        },
        remove_product_deleted_outof_orders: function (product_id) {
            var orders = this.get('orders').models;
            for (var n = 0; n < orders.length; n++) {
                var order = orders[n];
                for (var i = 0; i < order.orderlines.models.length; i++) {
                    var line = order.orderlines.models[i];
                    if (line.product.id == product_id) {
                        order.remove_orderline(line);
                    }
                }
            }
        },
        // TODO : -------- end sync -------------
        _auto_refresh_products: function () {
            var self = this;
            var status = new $.Deferred();
            var product_model = this.get_model('product.product');
            if (!product_model) {
                status.resolve();
            }
            rpc.query({
                model: 'product.product',
                method: 'search_read',
                domain: [['id', '<=', this.session.model_ids['product.product']['max_id']]],
                fields: product_model.fields,
            }, {
                shadow: true,
                timeout: 65000
            }).then(function (results) {
                indexed_db.write('product.product', results);
                status.resolve();
            }, function (error) {
                status.reject(error);
            });
            return status;
        },
        _auto_refresh_partners: function () {
            var self = this;
            var status = new $.Deferred();
            var product_model = this.get_model('res.partner');
            if (!product_model) {
                status.resolve();
            }
            rpc.query({
                model: 'res.partner',
                method: 'search_read',
                domain: [['id', '<=', this.session.model_ids['res.partner']['max_id']]],
                fields: product_model.fields,
            }, {
                shadow: true,
                timeout: 65000
            }).then(function (results) {
                indexed_db.write('res.partner', results);
                status.resolve();
            }, function (error) {
                status.reject(error);
            });
            return status;
        },
        _get_active_pricelist: function () {
            var current_order = this.get_order();
            var current_pricelist = this.default_pricelist;
            if (current_order && current_order.pricelist) {
                return current_order.pricelist
            } else {
                return current_pricelist
            }
        },
        sort_by: function (field, reverse, primer) {
            var key = primer ?
                function (x) {
                    return primer(x[field])
                } :
                function (x) {
                    return x[field]
                };
            reverse = !reverse ? 1 : -1;
            return function (a, b) {
                return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
            }
        },
        initialize: function (session, attributes) {
            this.deleted = {};
            this.load_indexed_db_done = false;
            this.max_load = 9999;
            this.next_load = 10000;
            this.session = session;
            this.sequence = 0;
            this.model_lock = [];
            this.model_unlock = [];
            this.model_ids = session['model_ids'];
            for (var i = 0; i < this.models.length; i++) {
                var this_model = this.models[i];
                if (this_model.model && this.model_ids[this_model.model]) {
                    this_model['max_id'] = this.model_ids[this_model.model]['max_id'];
                    this_model['min_id'] = this.model_ids[this_model.model]['min_id'];
                    this.model_lock = _.filter(this.model_lock, function (model_check) {
                        return model_check['model'] != this_model.model;
                    });
                    this.model_lock.push(this_model);

                } else {
                    this.model_unlock.push(this_model);
                }
            }
            var product_model = this.get_model('product.product');
            product_model.fields.push(
                'write_date',
            );
            var product_model = this.get_model('res.partner');
            product_model.fields.push(
                'write_date',
            );
            _super_PosModel.initialize.call(this, session, attributes)
        },
        get_process_time: function (min, max) {
            if (min > max) {
                return 1
            } else {
                return (min / max).toFixed(1)
            }
        },
        // TODO: when pos session online, if pos session have notification from backend, we get datas modifires and sync to pos
        get_data_by_id: function (model, id) {
            var self = this;
            var status = new $.Deferred();
            var args = [[], model, id];
            return rpc.query({
                model: 'pos.cache.database',
                method: 'get_data_by_id',
                args: args
            }).then(function (results) {
                if (results.length) {
                    var model = results[0]['model'];
                    self.sync_with_backend(model, results);
                }
                status.resolve();
            }, function (error) {
                if (error.code == -32098) {
                    console.warn('Your odoo backend offline, or your internet connection have problem');
                } else {
                    console.warn('Your database have issues, could sync with pos');
                }
                status.reject();
            });
            return status
        },
        get_modifiers_backend: function (model) {
            var self = this;
            var status = new $.Deferred();
            if (!this.db.write_date_by_model['product.product']) {
                status.resolve();
            }
            if (this.db.write_date_by_model[model]) {
                var args = [[], this.db.write_date_by_model[model], model, null];
                if ((model == 'pos.order' || model == 'pos.order.line') && this.config.pos_orders_load_all) {
                    args = [[], this.db.write_date_by_model[model], model, this.config.id];
                }
                return rpc.query({
                    model: 'pos.cache.database',
                    method: 'get_modifiers_backend',
                    args: args
                }).then(function (results) {
                    if (results.length) {
                        var model = results[0]['model'];
                        self.sync_with_backend(model, results);
                    }
                    status.resolve();
                }, function (error) {
                    if (error.code == -32098) {
                        console.warn('Your odoo backend offline, or your internet connection have problem');
                    } else {
                        console.warn('Your database have issues, could sync with pos');
                    }
                    status.reject();
                });
                return status
            } else {
                status.resolve();
                return status
            }
        },
        _get_model_big_datas: function () {
            var models = [];
            for (var i = 0; i < this.model_lock.length; i++) {
                models.push(this.model_lock[i]['model'])
            }
            var model_values = {};
            for (var index in models) {
                if (this.db.write_date_by_model[models[index]]) {
                    model_values[models[index]] = this.db.write_date_by_model[models[index]];
                }
            }
            return model_values
        },
        // TODO: get all modifiers of all models from backend and sync to pos
        get_modifiers_backend_all_models: function () {
            var self = this;
            var status = new $.Deferred();
            if (!this.db.write_date_by_model['product.product']) {
                return status.resolve([]);
            }
            var model_values = this.db.write_date_by_model;
            var args = [];
            if (this.config.pos_orders_load_all) {
                args = [[], model_values, null];
            } else {
                args = [[], model_values, this.config.id];
            }
            rpc.query({
                model: 'pos.cache.database',
                method: 'get_modifiers_backend_all_models',
                args: args
            }, {shadow: true, timeout: 65000}).then(function (results) {
                var total = 0;
                for (var model in results) {
                    var vals = results[model];
                    if (vals && vals.length) {
                        self.sync_with_backend(model, vals);
                        total += vals.length;
                    }
                }
                status.resolve(total);
            }, function (error) {
                if (error.code == -32098) {
                    console.warn('Your odoo backend offline, or your internet connection have problem');
                } else {
                    console.warn('Your database have issues, could sync with pos');
                }
                status.reject(error);
            });
            return status;
        },
        save_results: function (model, results) { // this method only call when indexdb_db running
            var object = _.find(this.model_lock, function (object_loaded) {
                return object_loaded.model == model;
            });
            if (object) {
                object.loaded(this, results, {})
            }
            this.load_indexed_db_done = true;
            this.db.set_last_write_date_by_model(model, results);
        },
        reload_pos: function () {
            location.reload();
        },
        api_install_datas: function (model_name) {
            var self = this;
            var loaded = new $.Deferred();
            var model = _.find(this.model_lock, function (model) {
                return model.model == model_name;
            });
            if (!model) {
                return loaded.resolve();
            }

            function installing_data(model_name, min_id, max_id) {
                var domain = [['id', '>=', min_id], ['id', '<', max_id]];
                var context = {};
                if (model['model'] == 'product.product') {
                    domain.push(['available_in_pos', '=', true]);
                    var price_id = null;
                    if (self.pricelist) {
                        price_id = self.pricelist.id;
                    }
                    var stock_location_id = null;
                    if (self.config.stock_location_id) {
                        stock_location_id = self.config.stock_location_id[0]
                    }
                    context['location'] = stock_location_id;
                    context['pricelist'] = price_id;
                    context['display_default_code'] = false;
                }
                if (min_id == 0) {
                    max_id = self.max_load;
                }
                var process = self.get_process_time(min_id, model['max_id']);
                self.chrome.loading_message(_t('Keep POS online, caching datas of ') + model['model'] + ': ' + (process * 100).toFixed(3) + ' %', process);
                return rpc.query({
                    model: 'pos.cache.database',
                    method: 'install_data',
                    args: [null, model_name, min_id, max_id]
                }).then(function (results) {
                    min_id += self.next_load;
                    if (typeof results == "string") {
                        results = JSON.parse(results);
                    }
                    if (results.length > 0) {
                        max_id += self.next_load;
                        installing_data(model_name, min_id, max_id);
                        indexed_db.write(model_name, results);
                        self.save_results(model_name, results);
                    } else {
                        if (max_id < model['max_id']) {
                            max_id += self.next_load;
                            installing_data(model_name, min_id, max_id);
                        } else {
                            loaded.resolve();
                        }
                    }
                }, function (error) {
                    var db = self.session.db;
                    for (var i = 0; i <= 100; i++) {
                        indexedDB.deleteDatabase(db + '_' + i);
                    }
                    if (error.code == -32098) {
                        self.chrome.loading_message(_t('Your odoo backend offline, or your internet connection have problem'));
                    } else {
                        self.chrome.loading_message(_t('Installing error, remove cache and try again'));
                    }
                })
            }

            installing_data(model_name, 0, self.first_load);
            return loaded;
        },
        remove_indexed_db: function () {
            var dbName = this.session.db;
            for (var i = 0; i <= 50; i++) {
                indexedDB.deleteDatabase(dbName + '_' + i);
            }
            console.log('remove_indexed_db succeed !')
        },
        load_server_data: function () {
            var self = this;
            this.models = this.model_unlock;
            return _super_PosModel.load_server_data.apply(this, arguments).then(function () {
                for (var index_number in self.model_lock) {
                    self.models.push(self.model_lock[index_number]);
                }
                if (!self.load_indexed_db_done) {
                    return $.when(self.api_install_datas('product.product')).then(function () {
                        return $.when(self.api_install_datas('res.partner')).then(function () {
                            return true;
                        })
                    })
                } else {
                    return true;
                }
            }).done(function () {
                if (self.config.allow_sync_direct) {
                    self.pos_sync_backend = new exports.pos_sync_backend(self);
                    self.pos_sync_backend.start();
                }
                return self.get_modifiers_backend_all_models()
            })
        }
    });
})
;
