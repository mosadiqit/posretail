"use strict";
odoo.define('pos_retail.screen_receipt', function (require) {

    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var rpc = require('pos.rpc');
    var qweb = core.qweb;

    screens.ReceiptScreenWidget.include({
        init_pos_before_calling: function (pos) {
            this.pos = pos;
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back_order').click(function () {
                var order = self.pos.get_order();
                if (order) {
                    self.pos.gui.show_screen('products');
                }
            });
        },
        print: function () {
            this._super();
            this.auto_print_network();
        },
        show: function () {
            this._super();
            try {
                var order = this.pos.get_order();
                if (this.pos.config.barcode_receipt && order && order['ean13']) {
                    this.$('img[id="barcode"]').removeClass('oe_hidden');
                    JsBarcode("#barcode", order['ean13'], {
                        format: "EAN13",
                        displayValue: true,
                        fontSize: 18
                    });
                }
            } catch (error) {
                console.error(error)
            }
            this.auto_print_network();
        },
        auto_print_network: function () {
            if (this.pos.epson_printer_default && this.pos.get_order()) {
                var odoo_version = this.pos.server_version;
                var env;
                var receipt;
                if (odoo_version == 10)
                    env = this.pos.gui.screen_instances['receipt'].get_receipt_data();
                else
                    env = this.pos.gui.screen_instances['receipt'].get_receipt_render_env();
                if (this.pos.config.receipt_without_payment_template == 'display_price') {
                    receipt = qweb.render('XmlReceipt', env);
                } else {
                    receipt = qweb.render('XmlReceiptNoPrice', env);
                }
                this.pos.print_network(receipt, this.pos.epson_printer_default['ip']);
            }
        },
        render_change: function () {
            if (this.pos.get_order()) {
                return this._super();
            }
        },
        get_receipt_data: function () { // this is function use for v10, dont remove
            var order = this.pos.get_order();
            var data_print = {
                widget: this,
                pos: this.pos,
                order: order,
                receipt: order.export_for_printing(),
                orderlines: order.get_orderlines(),
                paymentlines: order.get_paymentlines(),
            };
            var orderlines_by_category_name = {};
            var order = this.pos.get_order();
            var orderlines = order.orderlines.models;
            var categories = [];
            if (this.pos.config.category_wise_receipt) {
                for (var i = 0; i < orderlines.length; i++) {
                    var line = orderlines[i];
                    var line_print = line.export_for_printing();
                    line['product_name_wrapped'] = line_print['product_name_wrapped'];
                    var pos_categ_id = line['product']['pos_categ_id'];
                    if (pos_categ_id && pos_categ_id.length == 2 && order.get_root_category_by_category_id(pos_categ_id[0]) && this.pos.db.category_by_id[order.get_root_category_by_category_id(pos_categ_id[0])]) {
                        var root_category_id = order.get_root_category_by_category_id(pos_categ_id[0]);
                        var category = this.pos.db.category_by_id[root_category_id];
                        var category_name = category['name'];
                        if (!orderlines_by_category_name[category_name]) {
                            orderlines_by_category_name[category_name] = [line];
                            var category_index = _.findIndex(categories, function (category) {
                                return category == category_name;
                            });
                            if (category_index == -1) {
                                categories.push(category_name)
                            }
                        } else {
                            orderlines_by_category_name[category_name].push(line)
                        }

                    } else {
                        if (!orderlines_by_category_name['None']) {
                            orderlines_by_category_name['None'] = [line]
                        } else {
                            orderlines_by_category_name['None'].push(line)
                        }
                        var category_index = _.findIndex(categories, function (category) {
                            return category == 'None';
                        });
                        if (category_index == -1) {
                            categories.push('None')
                        }
                    }
                }
            }
            data_print['orderlines_by_category_name'] = orderlines_by_category_name;
            data_print['categories'] = categories;
            data_print['total_due'] = order.get_due(); // save amount due if have (display on receipt of parital order)
            return data_print;
        },

        get_receipt_render_env: function () { // function only for v11 or bigger than 11
            var data_print = this._super();
            var orderlines_by_category_name = {};
            var order = this.pos.get_order();
            var orderlines = order.orderlines.models;
            var categories = [];
            if (this.pos.config.category_wise_receipt) {
                for (var i = 0; i < orderlines.length; i++) {
                    var line = orderlines[i];
                    var line_print = line.export_for_printing();
                    line['product_name_wrapped'] = line_print['product_name_wrapped'][0];
                    var pos_categ_id = line['product']['pos_categ_id'];
                    if (pos_categ_id && pos_categ_id.length == 2 && order.get_root_category_by_category_id(pos_categ_id[0]) && this.pos.db.category_by_id[order.get_root_category_by_category_id(pos_categ_id[0])]) {
                        var root_category_id = order.get_root_category_by_category_id(pos_categ_id[0]);
                        var category = this.pos.db.category_by_id[root_category_id];
                        var category_name = category['name'];
                        if (!orderlines_by_category_name[category_name]) {
                            orderlines_by_category_name[category_name] = [line];
                            var category_index = _.findIndex(categories, function (category) {
                                return category == category_name;
                            });
                            if (category_index == -1) {
                                categories.push(category_name)
                            }
                        } else {
                            orderlines_by_category_name[category_name].push(line)
                        }

                    } else {
                        if (!orderlines_by_category_name['None']) {
                            orderlines_by_category_name['None'] = [line]
                        } else {
                            orderlines_by_category_name['None'].push(line)
                        }
                        var category_index = _.findIndex(categories, function (category) {
                            return category == 'None';
                        });
                        if (category_index == -1) {
                            categories.push('None')
                        }
                    }
                }
            }
            data_print['orderlines_by_category_name'] = orderlines_by_category_name;
            data_print['categories'] = categories;
            data_print['total_paid'] = order.get_total_paid(); // save amount due if have (display on receipt of parital order)
            data_print['total_due'] = order.get_due(); // save amount due if have (display on receipt of partial order)
            return data_print
        },
        store_last_receipt: function (receipt) {
            this.pos.report_xml = receipt;
        },
        auto_next_screen: function () {
            var self = this;
            if (this.pos.config.iface_print_via_proxy) {
                return true;
            } else {
                if (this.pos.config.auto_print_web_receipt) {
                    setTimeout(function () {
                        self.print_web();
                    }, 500)
                }
                if (this.pos.config.auto_nextscreen_when_validate_payment && this.pos.get_order() && !this.pos.get_order().temporary) {
                    setTimeout(function () {
                        var current_screen = self.pos.gui.get_current_screen();
                        var order = self.pos.get_order();
                        if (order && current_screen == 'receipt') {
                            self.pos.get_order().finalize();
                        }
                    }, 500) // TODO: wating 1 second for pos render barcode
                }
            }
        },
        print_web: function () {
            this.pos.gui.close_popup();
            this._super();
        },
        print_xml: function () {
            var self = this;
            var odoo_version = this.pos.server_version;
            var order = this.pos.get_order();
            if (odoo_version == 10)
                this.receipt_data = this.get_receipt_data();
            else
                this.receipt_data = this.get_receipt_render_env();
            if (this.pos.config.receipt_invoice_number && !this.pos.config.invoice_offline) {
                return rpc.query({
                    model: 'pos.order',
                    method: 'search_read',
                    domain: [['ean13', '=', order['ean13']]],
                    fields: ['invoice_id', 'id'],
                }).then(function (orders) {
                    if (orders.length > 0) {
                        if (orders[0]['invoice_id']) {
                            var invoice_number = orders[0]['invoice_id'][1].split(" ")[0];
                            self.receipt_data['order']['invoice_number'] = invoice_number;
                        }
                    }
                    var receipt = qweb.render('XmlReceipt', self.receipt_data);
                    self.store_last_receipt(receipt);
                    if (self.pos.config.duplicate_receipt && self.pos.config.print_number > 1) {
                        var i = 0;
                        while (i < self.pos.config.print_number) {
                            var timer = 1000 +  (i * 2500);
                            setTimeout(function () {
                                self.pos.proxy.print_receipt(receipt);
                            }, timer);
                            i++;
                        }
                    } else {
                        self.pos.proxy.print_receipt(receipt);
                    }
                    self.pos.get_order()._printed = true;
                });
            } else {
                var receipt = qweb.render('XmlReceipt', this.receipt_data);
                this.store_last_receipt(receipt);
                if (self.pos.config.duplicate_receipt && self.pos.config.print_number > 1) {
                    var i = 0;
                    while (i < self.pos.config.print_number) {
                        var timer = 1000 +  (i * 2500);
                        console.log(timer);
                        setTimeout(function () {
                            self.pos.proxy.print_receipt(receipt);
                        }, timer);
                        i++;
                    }
                } else {
                    this.pos.proxy.print_receipt(receipt);
                }
                this.pos.get_order()._printed = true;
            }
        },
        render_receipt: function () {
            var self = this;
            $('.ui-helper-hidden-accessible').css('display', 'none');
            var order = this.pos.get_order();
            this._super();
            if (this.pos.server_version == 10) { // save last receipt
                var order = this.pos.get_order();
                this.pos.report_html = qweb.render('PosTicket', {
                    widget: this,
                    order: order,
                    receipt: order.export_for_printing(),
                    orderlines: order.get_orderlines(),
                    paymentlines: order.get_paymentlines(),
                })
            } else { // save last receipt for v11 and higher
                this.pos.report_html = qweb.render('PosTicket', this.get_receipt_render_env());
            }
            if (!this.pos.config.iface_print_via_proxy && this.pos.config.receipt_invoice_number && order.is_to_invoice()) {
                var invoiced = new $.Deferred();
                rpc.query({
                    model: 'pos.order',
                    method: 'search_read',
                    domain: [['ean13', '=', order['ean13']]],
                    fields: ['invoice_id'],
                }).then(function (orders) {
                    if (orders.length > 0 && orders[0]['invoice_id'] && orders[0]['invoice_id'][1]) {
                        var invoice_number = orders[0]['invoice_id'][1].split(" ")[0];
                        self.pos.get_order()['invoice_number'] = invoice_number;
                        console.log('PRINT WEB INV NUM ' + invoice_number);
                    }
                    if (self.pos.config.duplicate_receipt && self.pos.config.print_number > 1) {
                        var contents = self.$('.pos-receipt-container');
                        contents.empty();
                        var i = 0;
                        while (i < self.pos.config.print_number) {
                            contents.append(qweb.render('PosTicket', self.get_receipt_data()));
                            i++;
                        }
                    }
                    if (!self.pos.config.duplicate_receipt) {
                        self.$('.pos-receipt-container').html(qweb.render('PosTicket', self.get_receipt_data()));
                    }
                    if (self.pos.config.ticket_font_size) {
                        self.$('.pos-sale-ticket').css({'font-size': self.pos.config.ticket_font_size})
                    }
                    self.auto_next_screen();
                    invoiced.resolve();
                }).fail(function (error) {
                    invoiced.reject(error);
                    return self.pos.query_backend_fail(error);
                });
                return invoiced;
            } else {
                if (this.pos.config.duplicate_receipt && this.pos.config.print_number > 1) {
                    var contents = this.$('.pos-receipt-container');
                    contents.empty();
                    var i = 0;
                    var data;
                    if (this.pos.server_version == 10) {
                        data = this.get_receipt_data();
                    } else {
                        data = this.get_receipt_render_env();
                    }
                    while (i < this.pos.config.print_number) {
                        contents.append(qweb.render('PosTicket', data));
                        i++;
                    }
                } else {
                    this._super();
                }
                if (this.pos.config.ticket_font_size) {
                    this.$('.pos-sale-ticket').css({'font-size': this.pos.config.ticket_font_size})
                }
                this.auto_next_screen();
            }
        },
    });
});
