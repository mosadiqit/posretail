"use strict";
odoo.define('pos_retail.multi_lots', function (require) {
    var gui = require('point_of_sale.gui');
    var PopupWidget = require('point_of_sale.popups');
    var screens = require('point_of_sale.screens');
    var rpc = require('pos.rpc');
    var models = require('point_of_sale.models');

    models.PosModel = models.PosModel.extend({
        sync_stock_production_lot: function () {
            var stock_production_lot_model = _.filter(this.models, function (model) {
                return model.lot
            });
            if (stock_production_lot_model) {
                for (var i = 0; i < stock_production_lot_model.length; i++) {
                    var model = stock_production_lot_model[i];
                    this.load_server_data_by_model(model);
                }
            }
        }
    });
    var popup_create_lots = PopupWidget.extend({
        template: 'popup_create_lots',
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .lot-add': 'add_new_lot',
            'click .lot-delete': 'delete_lot'
        }),
        init_quickly_search_products: function (options) {
            var $input_lot = this.$('input[name=product_id]');
            $input_lot.autocomplete({
                source: this.products_search,
                minLength: this.pos.config.min_length_search,
            });
        },
        show: function (options) {
            this.options = options;
            this._super(options);
            var self = this;
            this.$('.confirm').click(function () {
                self.click_confirm()
            });
            this.$('.cancel').click(function () {
                self.click_cancel();
            });
            var products = this.pos.db.get_product_by_category(0);
            var products_search = [];
            for (var i = 0; i < products.length; i++) {
                var product = products[i];
                if (product.tracking == 'lot' && this.pos.db.product_id_by_name[product['display_name']]) {
                    products_search.push({
                        value: product['display_name'],
                        label: product['display_name']
                    })
                }
            }
            this.products_search = products_search;
            this.init_quickly_search_products(this.options);
        },
        click_confirm: function () {
            var fields = {};
            var self = this;
            var is_valid = true;
            this.$('.lot_input').each(function (idx, el) {
                if (!fields[el.id]) {
                    fields[el.id] = {};
                }
                if (el.name == 'name') {
                    fields[el.id]['name'] = el.value || ''
                    if (el.value == "") {
                        is_valid = false;
                        return self.wrong_input("input[id=" + el.id + "][name='name']", '(*) Serial/Number is required');
                    } else {
                        self.passed_input("input[id=" + el.id + "][name='name']");
                    }
                    var name_lot_is_exist = self.pos.lot_by_name[el.value];
                    if (name_lot_is_exist) {
                        is_valid = false;
                        return self.wrong_input("input[id=" + el.id + "][name='name']", '(*) Serial/Number unique ' + el.value + ', this serial have exist');
                    } else {
                        self.passed_input("input[id=" + el.id + "][name='name']");
                    }
                }
                if (el.name == 'product_id') {
                    var product_id = self.pos.db.product_id_by_name[el.value];
                    if (product_id) {
                        fields[el.id]['product_id'] = product_id
                        self.passed_input("input[id=" + el.id + "][name='product_id']");
                    } else {
                        is_valid = false;
                        return self.wrong_input("input[id=" + el.id + "][name='product_id']", '(*) Product ' + el.value + ' does not exist. Please select product, dont input manual');
                    }
                }
                if (el.name == 'quantity') {
                    var quantity = parseFloat(el.value) || 0;
                    fields[el.id]['quantity'] = parseFloat(el.value) || 0;
                    if (quantity <= 0) {
                        is_valid = false;
                        return self.wrong_input("input[id=" + el.id + "][name='quantity']", '(*) Quantity required bigger than 0');
                    } else {
                        self.passed_input("input[id=" + el.id + "][name='quantity']");
                    }
                }
            });
            if (is_valid) {
                var lots = [];
                for (var index in fields) {
                    lots.push(fields[index])
                }
                if (lots.length) {
                    this.pos.gui.close_popup();
                    if (this.options.confirm) {
                        this.options.confirm.call(this, lots);
                    }
                } else {
                    return self.wrong_input("table[class='client-list']", '(*) Please input lots list');
                }
            }
        },
        add_new_lot: function (e) {
            var table = document.getElementById('lots_tree');
            var rowCount = table.getElementsByTagName("tbody")[0].getElementsByTagName("tr").length;

            var newRow = table.insertRow(rowCount);
            var row = rowCount - 1;
            newRow.id = row;

            var col0html = "<input class='lot_input'" + " name='name'" + " type='text'" + "id='" + row + "'" + ">" + "</input>";
            var col1html = "<input class='lot_input'" + " name='product_id'" + " type='text'" + "id='" + row + "'" + ">" + "</input>";
            var col2html = "<input class='lot_input'" + " name='quantity'" + " type='number'" + "id='" + row + "'" + ">" + "</input>";
            var col3html = "<span class='lot-delete fa fa-trash-o' name='delete'/>";

            var col0 = newRow.insertCell(0);
            col0.innerHTML = col0html;
            var col1 = newRow.insertCell(1);
            col1.innerHTML = col1html;
            var col2 = newRow.insertCell(2);
            col2.innerHTML = col2html;
            var col3 = newRow.insertCell(3);
            col3.innerHTML = col3html;
            this.init_quickly_search_products(this.options);

        },
        delete_lot: function (e) {
            var tr = $(e.currentTarget).closest('tr');
            var record_id = tr.find('td:first-child').text();
            if (parseInt(record_id))
                tr.find("td:not(:first)").remove();
            else
                tr.find("td").remove();
            tr.hide();
            this.init_quickly_search_products(this.options);
        }
    });
    gui.define_popup({name: 'popup_create_lots', widget: popup_create_lots});

    var button_create_lots = screens.ActionButtonWidget.extend({
        template: 'button_create_lots',
        init: function (parent, options) {
            this._super(parent, options);
        },
        button_click: function () {
            var self = this;
            if (!this.pos.config.stock_location_id) {
                return this.pos.gui.show_popup('confirm', {
                    title: 'Warning',
                    body: 'Your POS Config not Setting Stock Location'
                })
            }
            this.gui.show_popup('popup_create_lots', {
                title: 'Create lots',
                body: 'Name/Serial is unique, quantity required bigger than 0 and product required select not input manual',
                confirm: function (lots) {
                    var lot_model = self.pos.get_model('stock.production.lot');
                    return rpc.query({
                        model: 'stock.production.lot',
                        method: 'pos_create_lots',
                        args: [[], lots, lot_model.fields, self.pos.shop.name, self.pos.config.stock_location_id[0]],
                        context: {}
                    }).then(function () {
                        self.pos.sync_stock_production_lot();
                        self.pos.lots_cache = [];
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Great job',
                            body: 'Your list lots have created succeed at backend. You can use it now',
                            color: 'success'
                        })
                    }).fail(function (error) {
                        return self.pos.query_backend_fail(error);
                    });
                }
            })
        }
    });
    screens.define_action_button({
        'name': 'button_create_lots',
        'widget': button_create_lots,
        'condition': function () {
            return this.pos.config.create_lots;
        }
    });

    var popup_set_multi_lots = PopupWidget.extend({
        template: 'popup_set_multi_lots',
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .lot-add': 'add_new_lot',
            'click .lot-delete': 'delete_lot'
        }),
        show: function (options) {
            var self = this;
            this.pos.sync_stock_production_lot();
            if (options && options.selected_orderline) {
                options.lot_ids = options.selected_orderline.lot_ids;
            } else {
                options.lot_ids = [];
            }
            this.options = options;
            this.lots = this.options.lots;
            this._super(options);
            this.$('.confirm').click(function () {
                self.click_confirm()
            });
            this.$('.cancel').click(function () {
                self.click_cancel();
            });
        },
        click_confirm: function () {
            var fields = {};
            var total_quantity = 0;
            var selected_line = this.options.selected_orderline;
            this.$('.lot_input').each(function (idx, el) {
                if (!fields[el.id]) {
                    fields[el.id] = {};
                }
                if (el.name == 'lot_quantity') {
                    total_quantity += parseFloat(el.value) || null || 0;
                    fields[el.id]['quantity'] = parseFloat(el.value) || null || 0;
                }
                if (el.name == 'lot_id') {
                    fields[el.id]['id'] = parseInt(el.value) || null
                }
            });
            if (total_quantity > selected_line['quantity']) {
                return this.wrong_input("div[class='lots-grid']", "(*) Total quantity of lots could not bigger than quantity of line selected");
            }
            this.pos.gui.close_popup();
            if (this.options.confirm) {
                var lots = [];
                for (var index in fields) {
                    lots.push(fields[index])
                }
                this.options.confirm.call(this, lots);
            }
        },
        add_new_lot: function (e) {
            var table = document.getElementById('lots_list');
            var rowCount = table.getElementsByTagName("tbody")[0].getElementsByTagName("tr").length;

            var newRow = table.insertRow(rowCount);
            var row = rowCount - 1;
            newRow.id = row;

            var col0html = "<select style='width: 100%;height: 60px' class='form-control voucher-select lot_input' name='lot_id'" + "id='" + row + "'" + ">";
            for (var i = 0; i < this.lots.length; i++) {
                var lot = this.lots[i];
                col0html += "<option value=" + lot.id + ">";
                col0html += lot.name;
                if (lot.barcode) {
                    col0html += '[Ean13]:' + lot.barcode;
                }
                col0html += "</option>"
            }
            col0html += "</select>";
            var col1html = "<input style='width: 100%' class='lot_input'" + " name='lot_quantity'" + " type='number'" + "id='" + row + "'" + ">" + "</input>";
            var col2html = "<span class='lot-delete fa fa-trash-o' name='delete'/>";

            var col0 = newRow.insertCell(0);
            col0.innerHTML = col0html;
            var col1 = newRow.insertCell(1);
            col1.innerHTML = col1html;
            var col2 = newRow.insertCell(2);
            col2.innerHTML = col2html;

        },
        delete_lot: function (e) {
            var tr = $(e.currentTarget).closest('tr');
            var record_id = tr.find('td:first-child').text();
            if (parseInt(record_id))
                tr.find("td:not(:first)").remove();
            else
                tr.find("td").remove();
            tr.hide();
        }
    });
    gui.define_popup({name: 'popup_set_multi_lots', widget: popup_set_multi_lots});
});
