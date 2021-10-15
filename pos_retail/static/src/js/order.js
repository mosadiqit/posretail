"use strict";
/*
    This module create by: thanhchatvn@gmail.com
    License: OPL-1
    Please do not modification if i not accept
    Thanks for understand
 */
odoo.define('pos_retail.order', function (require) {

    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var models = require('point_of_sale.models');
    var core = require('web.core');
    var _t = core._t;

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function (attributes, options) {
            _super_Order.initialize.apply(this, arguments);
            var self = this;
            this.orderlines.bind('change add remove', function (line) {
                self.pos.trigger('update:count_item')
            });
            if (!this.note) {
                this.note = '';
            }
            if (!this.signature) {
                this.signature = '';
            }
            this.orderlines.bind('change add remove', function (line) {
                self.trigger('update:table-list');
            });
            if (!options.json) {
                if (!this.location) {
                    var location = this.get_location();
                    this.set_location(location)
                }
                if (this.pos.config.pos_auto_invoice) {
                    this.to_invoice = true;
                }
                if (this.pos.server_version == 10 && this.pos.default_pricelist) { // default price list for version 10
                    if (!this.pricelist) {
                        this.pricelist = this.pos.default_pricelist;
                        this.set_pricelist_to_order(this.pricelist);
                    }
                }
                if (!this.lock) {
                    this.lock = false;
                }
                if (!this.seller && this.pos.default_seller) {
                    this.seller = this.pos.default_seller;
                }
            }
        },
        init_from_JSON: function (json) {
            // TODO: we removed line have product removed
            var lines = json.lines;
            var lines_without_product_removed = [];
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var product_id = line[2]['product_id'];
                var product = this.pos.db.get_product_by_id(product_id);
                if (product) {
                    lines_without_product_removed.push(line)
                }
            }
            json.lines = lines_without_product_removed;
            // ---------------------------------
            var res = _super_Order.init_from_JSON.apply(this, arguments);
            if (json.date) {
                this.date = json.date;
            }
            if (json.name) {
                this.name = json.name;
            }
            if (json.email_invoice) {
                this.email_invoice = json.email_invoice;
            }
            if (json.email_invoice) {
                this.email_invoice = json.email_invoice;
            }
            if (json.delivery_date) {
                this.delivery_date = json.delivery_date;
            }
            if (json.delivery_address) {
                this.delivery_address = json.delivery_address;
            }
            if (json.delivery_phone) {
                this.delivery_phone = json.delivery_phone;
            }
            if (json.amount_debit) {
                this.amount_debit = json.amount_debit;
            }
            if (json.sale_id) {
                this.sale_id = json.sale_id;
            }
            if (json.return_order_id) {
                this.return_order_id = json.return_order_id;
            }
            if (json.is_return) {
                this.is_return = json.is_return;
            }
            if (json.to_invoice) {
                this.to_invoice = json.to_invoice;
            }
            if (json.parent_id) {
                this.parent_id = json.parent_id;
            }
            if (json.sale_journal) {
                this.sale_journal = json.sale_journal;
            } else {
                this.sale_journal = this.pos.get_default_sale_journal();
            }
            if (json.ean13) {
                this.ean13 = json.ean13;
            }
            if (json.signature) {
                this.signature = json.signature
            }
            if (json.note) {
                this.note = json.note
            }
            if (this.pos.server_version == 10 && this.pos.default_pricelist) { // init price list for version 10
                if (json.pricelist_id) {
                    this.pricelist = _.find(this.pos.pricelists, function (pricelist) {
                        return pricelist.id === json.pricelist_id;
                    });
                    if (this.pricelist) {
                        this.set_pricelist_to_order(this.pricelist);
                    } else {
                        this.pricelist = this.pos.default_pricelist;
                        this.set_pricelist_to_order(this.pos.default_pricelist);
                    }
                } else {
                    this.pricelist = this.pos.default_pricelist;
                    this.set_pricelist_to_order(this.pricelist);
                }
            }
            if (json.lock) {
                this.lock = json.lock;
            } else {
                this.lock = false;
            }
            if (json.medical_insurance_id) {
                this.medical_insurance = this.pos.db.insurance_by_id[json.medical_insurance_id];
            }
            if (json.guest) {
                this.guest = json.guest;
            }
            if (json.guest_number) {
                this.guest_number = json.guest_number;
            }
            if (json.location_id) {
                this.location_id = json.location_id;
                this.location = this.pos.stock_location_by_id[json.location_id];
            }
            if (json.add_credit) {
                this.add_credit = json.add_credit
            } else {
                this.add_credit = false;
            }
            if (json.user_id) {
                this.seller = this.pos.user_by_id[json.user_id];
            }
            if (json.pos_branch_id) {
                this.pos_branch_id = json.pos_branch_id;
            }
            return res;
        },
        export_as_JSON: function () {
            var json = _super_Order.export_as_JSON.apply(this, arguments);
            if (this.seller) {
                json.user_id = this.seller['id'];
            }
            if (this.partial_payment) {
                json.partial_payment = this.partial_payment
            }
            if (this.email_invoice) {
                json.email_invoice = this.email_invoice;
                var client = this.get_client();
                if (client && client.email) {
                    json.email = client.email;
                }
            }
            if (this.delivery_date) {
                json.delivery_date = this.delivery_date;
            }
            if (this.delivery_address) {
                json.delivery_address = this.delivery_address;
            }
            if (this.delivery_phone) {
                json.delivery_phone = this.delivery_phone;
            }
            if (this.amount_debit) {
                json.amount_debit = this.amount_debit;
            }
            if (this.sale_id) {
                json.sale_id = this.sale_id;
            }
            if (this.return_order_id) {
                json.return_order_id = this.return_order_id;
            }
            if (this.is_return) {
                json.is_return = this.is_return;
            }
            if (this.parent_id) {
                json.parent_id = this.parent_id;
            }
            if (this.sale_journal) {
                json.sale_journal = this.sale_journal;
            } else {
                this.sale_journal = this.pos.get_default_sale_journal();
            }
            if (this.note) {
                json.note = this.note;
            }
            if (this.signature) {
                json.signature = this.signature;
            }
            if (this.ean13) {
                json.ean13 = this.ean13;
            }
            if (!this.ean13 && this.uid) {
                var ean13_code = this.zero_pad(this.pos.user.id, 4) + this.zero_pad(this.pos.pos_session.login_number, 4) + this.zero_pad(this.sequence_number, 4);
                var ean13 = ean13_code.split("");
                var ean13_array = [];
                for (var i = 0; i < ean13.length; i++) {
                    if (i < 12) {
                        ean13_array.push(ean13[i])
                    }
                }
                this.ean13 = ean13_code + this.generate_unique_ean13(ean13_array).toString();
            }
            if (!this.index_number_order && this.uid) {
                var index_number_order = '777';
                if (this.pos.user.id) {
                    index_number_order += this.pos.user.id;
                }
                if (this.sequence_number) {
                    index_number_order += this.sequence_number;
                }
                if (this.pos.config.id) {
                    index_number_order += this.pos.config.id;
                }
                var format_index_number_order = this.uid.split('-');
                for (var i in format_index_number_order) {
                    index_number_order += format_index_number_order[i];
                }
                index_number_order = index_number_order.split("");
                var index_number_order_array = [];
                var index_number_order_str = "";
                for (var i = 0; i < index_number_order.length; i++) {
                    if (i < 12) {
                        index_number_order_str += index_number_order[i];
                        index_number_order_array.push(index_number_order[i])
                    }
                }
                this.index_number_order = index_number_order_str + this.generate_unique_ean13(index_number_order_array).toString();
            }
            if (this.lock) {
                json.lock = this.lock;
            } else {
                json.lock = false;
            }
            if (this.invoice_number) {
                json.invoice_number = this.invoice_number
            }
            if (this.medical_insurance) {
                json.medical_insurance_id = this.medical_insurance.id
            }
            if (this.guest) {
                json.guest = this.guest.id
            }
            if (this.guest_number) {
                json.guest_number = this.guest_number.id
            }
            if (this.add_credit) {
                json.add_credit = this.add_credit
            } else {
                json.add_credit = false
            }
            if (this.location) {
                json.location_id = this.location['id'];
            }
            if (this.pos.config.pos_branch_id) {
                json.pos_branch_id = this.pos.config.pos_branch_id[0];
            }
            return json;
        },
        export_for_printing: function () {
            var receipt = _super_Order.export_for_printing.call(this);
            var order = this.pos.get_order();
            if (this.seller) {
                receipt['seller'] = this.seller;
            }
            if (this.location) {
                receipt['location'] = this.location;
            } else {
                var stock_location_id = this.pos.config.stock_location_id;
                if (stock_location_id) {
                    receipt['location'] = this.pos.stock_location_by_id[stock_location_id[0]];
                }
            }
            receipt['guest'] = this.guest;
            receipt['guest_number'] = this.guest_number;
            receipt['medical_insurance'] = null;
            receipt['delivery_date'] = this.delivery_date;
            receipt['delivery_address'] = this.delivery_address;
            receipt['delivery_phone'] = this.delivery_phone;
            receipt['note'] = this.note;
            receipt['signature'] = this.signature;
            if (this.fiscal_position) {
                receipt.fiscal_position = this.fiscal_position
            }
            if (this.amount_debit) {
                receipt['amount_debit'] = this.amount_debit;
            }
            if (this.medical_insurance) {
                receipt['medical_insurance'] = this.medical_insurance;
            }
            var orderlines_by_category_name = {};
            var orderlines = order.orderlines.models;
            var categories = [];
            receipt['categories'] = [];
            receipt['orderlines_by_category_name'] = [];
            if (this.pos.config.category_wise_receipt) {
                for (var i = 0; i < orderlines.length; i++) {
                    var line = orderlines[i];
                    var pos_categ_id = line['product']['pos_categ_id']
                    line['tax_amount'] = line.get_tax();
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
                receipt['orderlines_by_category_name'] = orderlines_by_category_name;
                receipt['categories'] = categories;
            }
            receipt['total_due'] = order.get_due(); // save amount due if have (display on receipt of parital order)
            return receipt
        },
        remove_selected_orderline: function () {
            var line = this.get_selected_orderline()
            if (line) {
                this.remove_orderline(line)
            }
        },
        zero_pad: function (num, size) {
            var s = "" + num;
            while (s.length < size) {
                s = s + Math.floor(Math.random() * 10).toString();
            }
            return s;
        },
        set_location: function (location) {
            this.location = location;
            this.trigger('change', this);
        },
        get_location: function () {
            var stock_location_id = this.pos.config.stock_location_id;
            var selected_order = this;
            if (selected_order && selected_order.location) {
                return selected_order.location;
            }
            if (stock_location_id) {
                var location = this.pos.stock_location_by_id[stock_location_id[0]];
                return location;
            } else {
                return null
            }
        },
        show_popup_multi_lot: function () {
            var self = this;
            this.pos.gui.show_popup('popup_set_multi_lots', {
                'title': 'Add lots',
                'body': 'Allow you set multi lots on selected line, made sure total quantities of lots the same of quantity of selected line',
                'selected_orderline': this.selected_orderline,
                'lots': this.pos.lot_by_product_id[this.selected_orderline.product.id],
                confirm: function (lot_ids) {
                    var selected_orderline = self.selected_orderline;
                    var lot_selected = [];
                    for (var i = 0; i < lot_ids.length; i++) {
                        var lot = lot_ids[i];
                        var lot_record = self.pos.lot_by_id[lot['id']];
                        if (lot_record && lot['quantity'] && lot['quantity'] > 0) {
                            lot['name'] = lot_record['name'];
                            lot_selected.push(lot)
                        }
                    }
                    selected_orderline.lot_ids = lot_selected;
                    selected_orderline.trigger('change', selected_orderline);
                    selected_orderline.trigger('trigger_update_line');
                    if (lot_selected.length == 0) {
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Lots removed out of line selected'
                        })
                    }
                }
            })
        },
        display_lot_popup: function () {
            if (!this.pos.config.multi_lots) {
                return _super_Order.display_lot_popup.apply(this, arguments);
            } else {
                return this.show_popup_multi_lot();
            }
        },
        get_medical_insurance: function () {
            if (this.medical_insurance) {
                return this.medical_insurance
            } else {
                return null
            }
        },
        get_guest: function () {
            if (this.guest) {
                return this.guest
            } else {
                return null
            }
        },
        set_client: function (client) {
            var self = this;
            var res = _super_Order.set_client.apply(this, arguments);
            if (client) {
                var partial_payment_orders = _.filter(this.pos.db.get_pos_orders(), function (order) {
                    return order['partner_id'] && order['partner_id'][0] == client['id'] && order['state'] == 'partial_payment';
                });
                if (partial_payment_orders.length != 0) {
                    var warning_message = 'Customer selected have orders: ';
                    for (var i = 0; i < partial_payment_orders.length; i++) {
                        warning_message += partial_payment_orders[i]['name'];
                        warning_message += '(' + partial_payment_orders[i]['date_order'] + ')';
                        if ((i + 1) == partial_payment_orders.length) {
                            warning_message += ' .';
                        } else {
                            warning_message += ',';
                        }
                    }
                    warning_message += ' not payment full, please check it before made new order';
                    if (this.pos.gui.popup_instances['dialog']) {
                        this.pos.gui.show_popup('dialog', {
                            title: 'WARNING',
                            body: warning_message,
                        })
                    }
                }
                if (client.group_ids.length > 0) {
                    var list = [];
                    for (var i = 0; i < client.group_ids.length; i++) {
                        var group_id = client.group_ids[i];
                        var group = this.pos.membership_group_by_id[group_id];
                        if (group.pricelist_id) {
                            list.push({
                                'label': group.name,
                                'item': group
                            });
                        }
                    }
                    if (list.length > 0 && this.pos.gui.popup_instances['selection']) {
                        setTimeout(function () {
                            self.pos.gui.show_popup('selection', {
                                title: _t('Please add group/membership to customer ' + client.name),
                                list: list,
                                confirm: function (group) {
                                    if (!self.pos.pricelist_by_id || !self.pos.pricelist_by_id[group.pricelist_id[0]]) {
                                        return self.pos.gui.show_popup('dialog', {
                                            title: 'Warning',
                                            body: 'Your POS not added pricelist ' + group.pricelist_id[1],
                                        })
                                    }
                                    var pricelist = self.pos.pricelist_by_id[group.pricelist_id[0]];
                                    var order = self.pos.get_order();
                                    if (order && pricelist) {
                                        order.set_pricelist(pricelist);
                                        return self.pos.gui.show_popup('dialog', {
                                            title: 'Succeed',
                                            body: group.pricelist_id[1] + ' added',
                                            color: 'success'
                                        })
                                    }
                                }
                            });
                        }, 1000);
                    }
                }
            }
            return res
        },
        validate_medical_insurance: function () {
            var lines = this.orderlines.models;
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (line['medical_insurance']) {
                    this.remove_orderline(line);
                }
            }
            if (this.medical_insurance) {
                var total_without_tax = this.get_total_without_tax();
                var product = this.pos.db.product_by_id[this.medical_insurance.product_id[0]]
                var price = total_without_tax / 100 * this.medical_insurance.rate
                this.add_product(product, {
                    price: price,
                    quantity: -1
                });
                var selected_line = this.get_selected_orderline();
                selected_line['medical_insurance'] = true;
                selected_line.discount_reason = this.medical_insurance.name;
                selected_line.trigger('trigger_update_line', selected_line);
                selected_line.trigger('change', selected_line);
            }
        },
        validate_global_discount: function () {
            var self = this;
            var client = this && this.get_client();
            if (client && client['discount_id']) {
                this.pos.gui.show_screen('products');
                this.discount = this.pos.discount_by_id[client['discount_id'][0]];
                this.pos.gui.show_screen('products');
                var body = client['name'] + ' have discount ' + self.discount['name'] + '. Do you want to apply ?';
                return this.pos.gui.show_popup('confirm', {
                    'title': _t('Customer special discount ?'),
                    'body': body,
                    confirm: function () {
                        self.add_global_discount(self.discount);
                        self.pos.gui.show_screen('payment');
                        self.validate_payment();
                    },
                    cancel: function () {
                        self.pos.gui.show_screen('payment');
                        self.validate_payment();
                    }
                });
            } else {
                this.validate_payment();
            }
        },
        validate_payment: function () {
            if (this.pos.config.validate_payment) { // TODO: validate payment
                this.pos.gui.show_screen('products');
                this.pos._validate_by_manager("this.pos.gui.show_screen('payment')");
            }
        },
        validate_payment_order: function () {
            var self = this;
            var client = this.get_client();
            if (this.pos.config.multi_lots) {
                var orderlines = this.orderlines.models; // checking multi lots
                for (var i = 0; i < orderlines.length; i++) {
                    var orderline = orderlines[i];
                    if (orderline.product.tracking == 'lot') {
                        if (!orderline.lot_ids) {
                            this.pos.gui.show_screen('products');
                            return this.pos.gui.show_popup('confirm', {
                                'title': _t('Error'),
                                'body': _t('Product ' + orderline.product.display_name + ' null lots. Because your pos active multi lots, required add lots')
                            });
                        }
                        var sum = 0;
                        for (var j = 0; j < orderline.lot_ids.length; j++) {
                            sum += parseFloat(orderline.lot_ids[j]['quantity'])
                        }
                        if (sum != orderline.quantity && sum != 0) {
                            this.pos.gui.show_screen('products');
                            return this.pos.gui.show_popup('confirm', {
                                'title': _t('Could not process payment'),
                                'body': _t('Product ' + orderline.product.display_name + ' required set quantity of lots the same with quantity of line. And your pos active multi lots, required add lots')
                            });
                        }
                    }
                }
            }
            if (!client && this.pos.config.add_customer_before_products_already_in_shopping_cart) {
                setTimeout(function () {
                    self.pos.gui.show_screen('products');
                    self.pos.gui.show_screen('clientlist');
                    self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Please add client the first'
                    })
                }, 300);
            }
            if (this && this.orderlines.models.length == 0) {
                this.pos.gui.show_screen('products');
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Your order lines is blank'
                })
            }
            if (this.remaining_point && this.remaining_point < 0) {
                this.pos.gui.show_screen('products');
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'You could not applied redeem point bigger than client point',
                });
            }
            if (!this.is_return) {
                this.validate_promotion();
                this.validate_medical_insurance();
            }
        },
        add_global_discount: function (discount) {
            var total_without_tax = this.get_total_with_tax();
            var product = this.pos.db.product_by_id[discount.product_id[0]];
            var price = total_without_tax / 100 * discount['amount'];
            this.add_product(product, {
                price: price,
                quantity: -1
            });
            var selected_line = this.get_selected_orderline();
            selected_line.discount_reason = discount.reason;
            selected_line.trigger('trigger_update_line', selected_line);
            selected_line.trigger('change', selected_line);
        },
        set_to_invoice: function (to_invoice) {
            if (to_invoice) {
                this.add_credit = false;
                this.trigger('change');
            }
            return _super_Order.set_to_invoice.apply(this, arguments);
        },
        is_add_credit: function () {
            return this.add_credit
        },
        add_order_credit: function () {
            this.add_credit = !this.add_credit;
            if (this.add_credit) {
                this.create_voucher = false;
                this.set_to_invoice(false);
            }
            this.trigger('change');
            if (this.add_credit && !this.get_client()) {
                this.pos.gui.show_screen('clientlist');
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Please add customer need add credit'
                })
            }
        },
        is_email_invoice: function () { // send email invoice or not
            return this.email_invoice;
        },
        set_email_invoice: function (email_invoice) {
            this.assert_editable();
            this.email_invoice = email_invoice;
            this.set_to_invoice(email_invoice);
        },
        get_root_category_by_category_id: function (category_id) { // get root of category, root is parent category is null
            var root_category_id = category_id;
            var category_parent_id = this.pos.db.category_parent[category_id];
            if (category_parent_id) {
                root_category_id = this.get_root_category_by_category_id(category_parent_id)
            }
            return root_category_id
        },
        // odoo wrong when compute price with tax have option price inclued
        // and now i fixing
        fix_tax_included_price: function (line) {
            _super_Order.fix_tax_included_price.apply(this, arguments);
            if (this.fiscal_position) {
                var unit_price = line.product['list_price'];
                var taxes = line.get_taxes();
                var mapped_included_taxes = [];
                _(taxes).each(function (tax) {
                    var line_tax = line._map_tax_fiscal_position(tax);
                    if (tax.price_include && tax.id != line_tax.id) {

                        mapped_included_taxes.push(tax);
                    }
                });
                if (mapped_included_taxes.length > 0) {
                    unit_price = line.compute_all(mapped_included_taxes, unit_price, 1, this.pos.currency.rounding, true).total_excluded;
                    line.set_unit_price(unit_price);
                }
            }
        },
        set_signature: function (signature) {
            this.signature = signature;
            this.trigger('change', this);
        },
        get_signature: function () {
            if (this.signature) {
                return 'data:image/png;base64, ' + this.signature
            } else {
                return null
            }
        },
        set_note: function (note) {
            this.note = note;
            this.trigger('change', this);
        },
        get_note: function (note) {
            return this.note;
        },
        active_button_add_wallet: function (active) {
            var $add_wallet = $('.add_wallet');
            if (!$add_wallet) {
                return;
            }
            if (active) {
                $add_wallet.removeClass('oe_hidden');
                $add_wallet.addClass('highlight')
            } else {
                $add_wallet.addClass('oe_hidden');
            }
        },
        get_change: function (paymentline) {
            var change = _super_Order.get_change.apply(this, arguments);
            var client = this.get_client();
            var wallet_register = _.find(this.pos.cashregisters, function (register_journal) {
                return register_journal.journal['pos_method_type'] == 'wallet';
            }); // display wallet method when have change
            if (wallet_register) {
                var $journal_element = $("[data-id='" + wallet_register.journal['id'] + "']");
                if (change > 0 || (client && client['wallet'] > 0)) {
                    $journal_element.removeClass('oe_hidden');
                    $journal_element.addClass('highlight');
                } else {
                    $journal_element.addClass('oe_hidden');
                }
            }
            if (change > 0) {
                this.active_button_add_wallet(true);
            } else {
                this.active_button_add_wallet(false);
            }
            return change;
        },
        get_due_with_currency: function (paymentline) {
            var due = _super_Order.get_due.apply(this, arguments);
            var selected_currency = this.selected_currency;
            if (selected_currency) {
                return due * selected_currency['rate']
            }
            return due
        },
        get_due_without_rounding: function (paymentline) {
            if (!paymentline) {
                var due = this.get_total_with_tax() - this.get_total_paid();
            } else {
                var due = this.get_total_with_tax();
                var lines = this.paymentlines.models;
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i] === paymentline) {
                        break;
                    } else {
                        due -= lines[i].get_amount();
                    }
                }
            }
            return due;
        },
        generate_unique_ean13: function (array_code) {
            if (array_code.length != 12) {
                return -1
            }
            var evensum = 0;
            var oddsum = 0;
            for (var i = 0; i < array_code.length; i++) {
                if ((i % 2) == 0) {
                    evensum += parseInt(array_code[i])
                } else {
                    oddsum += parseInt(array_code[i])
                }
            }
            var total = oddsum * 3 + evensum;
            return parseInt((10 - total % 10) % 10)
        },
        get_product_image_url: function (product) {
            return window.location.origin + '/web/image?model=product.product&field=image_medium&id=' + product.id;
        },
        add_product: function (product, options) {
            var self = this;
            if (!this.pos.config.allow_order_out_of_stock && product.type == 'product' && product['qty_available'] <= 0) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Your POS Config not allow sale when products out of stock',
                });
            }
            if (product && product['qty_available'] && product['qty_available'] <= 0 && this.pos.config['allow_order_out_of_stock'] == false && product['type'] == 'product') {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Product is out of stock',
                });
            }
            var res = _super_Order.add_product.apply(this, arguments);
            var selected_orderline = this.get_selected_orderline();
            var combo_items = [];
            for (var i = 0; i < this.pos.combo_items.length; i++) {
                var combo_item = this.pos.combo_items[i];
                if (combo_item.product_combo_id[0] == selected_orderline.product.product_tmpl_id && (combo_item.default == true || combo_item.required == true)) {
                    combo_items.push(combo_item);
                }
            }
            if (selected_orderline && combo_items) {
                selected_orderline['combo_items'] = combo_items;
                var price_extra = 0;
                for (var i = 0; i < combo_items.length; i++) {
                    var combo_item = combo_items[i];
                    if (combo_item['price_extra']) {
                        price_extra += combo_item['price_extra'];
                    }
                }
                if (price_extra) {
                    selected_orderline.set_unit_price(selected_orderline.price + price_extra);
                }
                selected_orderline.trigger('change', selected_orderline);
                selected_orderline.trigger('trigger_update_line', selected_orderline);
            }
            var product_tmpl_id = product['product_tmpl_id'];
            if (selected_orderline && product_tmpl_id && selected_orderline && product_tmpl_id.length == undefined && product['cross_selling']) {
                selected_orderline.show_cross_sale();
            }
            if (selected_orderline && this.pos.variant_by_product_tmpl_id[selected_orderline.product.product_tmpl_id]) {
                setTimeout(function () {
                    self.pos.gui.show_popup('popup_select_variants', {
                        variants: self.pos.variant_by_product_tmpl_id[selected_orderline.product.product_tmpl_id],
                        selected_orderline: selected_orderline,
                    });
                }, 500)
            }
            return res
        },
        validation_order_can_do_internal_transfer: function () {
            var can_do = true;
            for (var i = 0; i < this.orderlines.models.length; i++) {
                var product = this.orderlines.models[i].product;
                if (product['type'] == 'service' || product['uom_po_id'] == undefined) {
                    can_do = false;
                }
            }
            if (this.orderlines.models.length == 0) {
                can_do = false;
            }
            return can_do;
        },
        // set prices list to order
        // this method only use for version 10
        set_pricelist_to_order: function (pricelist) { // v10 only
            var self = this;
            if (!pricelist) {
                return;
            }
            this.pricelist = pricelist;
            // change price of current order lines
            _.each(this.get_orderlines(), function (line) {
                if (line['product']) {
                    var price = self.pos.get_price(line['product'], pricelist, line.quantity);
                    line['product']['price'] = price;
                    line.set_unit_price(price);
                }
            });
            // after update order lines price
            // will update screen product and with new price
            this.update_product_price(pricelist);
            this.trigger('change', this);
        },
        update_product_price: function (pricelist) {
            var self = this;
            var products = this.pos.db.get_product_by_category(0);
            if (!products) {
                return;
            }
            for (var i = 0; i < products.length; i++) {
                var product = products[i];
                var price = this.pos.get_price(product, pricelist, 1);
                product['price'] = price;
            }
            self.pos.trigger('product:change_price_list', products)
        }
    });

    var _super_Orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function (attributes, options) {
            var res = _super_Orderline.initialize.apply(this, arguments);
            if (!options.json) {
                // TODO: if sync between session active auto set seller is user assigned
                if (this.pos.config.sync_multi_session && this.pos.config.user_id) {
                    var seller = this.pos.user_by_id[this.pos.config.user_id[0]];
                    if (seller) {
                        this.set_sale_person(seller)
                    }
                }
                // TODO: if default seller auto set user_id for pos_order_line
                if (this.pos.default_seller) {
                    this.set_sale_person(this.pos.default_seller)
                }
                this.selected_combo_items = {};
            }
            return res;
        },
        init_from_JSON: function (json) {
            var res = _super_Orderline.init_from_JSON.apply(this, arguments);
            if (json.user_id) {
                var seller = this.pos.user_by_id[json.user_id];
                if (seller) {
                    this.set_sale_person(seller)
                }
            }
            if (json.tag_ids && json.tag_ids.length) {
                var tag_ids = json.tag_ids[0][2];
                if (tag_ids) {
                    this.set_tags(tag_ids)
                }
            }
            if (json.is_return) {
                this.is_return = json.is_return;
            }
            if (json.combo_item_ids && json.combo_item_ids.length) {
                var combo_item_ids = json.combo_item_ids[0][2];
                if (combo_item_ids) {
                    this.set_combo_items(combo_item_ids)
                }
            }
            if (json.variant_ids && json.variant_ids.length) {
                var variant_ids = json.variant_ids[0][2];
                if (variant_ids) {
                    this.set_variants(variant_ids)
                }
            }
            if (json.uom_id) {
                this.uom_id = json.uom_id;
                var unit = this.pos.units_by_id[json.uom_id];
                if (unit) {
                    this.product.uom_id = [unit['id'], unit['name']];
                }
            }
            if (this.note) {
                this.note = this.set_line_note(json.note);
            }
            if (json.discount_reason) {
                this.discount_reason = json.discount_reason
            }
            if (json.medical_insurance) {
                this.medical_insurance = json.medical_insurance;
            }
            if (json.frequent_buyer_id) {
                this.frequent_buyer_id = json.frequent_buyer_id;
            }
            if (json.packaging_id && this.pos.packaging_by_id) {
                this.packaging = this.pos.packaging_by_id[json.packaging_id];
            }
            if (json.lot_ids) {
                this.lot_ids = json.lot_ids;
            }
            if (json.manager_user_id) {
                this.manager_user = this.pos.user_by_id[json.manager_user_id]
            }
            if (json.pos_branch_id) {
                this.pos_branch_id = json.pos_branch_id
            }
            return res;
        },
        export_as_JSON: function () {
            var json = _super_Orderline.export_as_JSON.apply(this, arguments);
            if (this.seller) {
                json.user_id = this.seller.id;
            }
            if (this.tags && this.tags.length) {
                json.tag_ids = [[6, false, _.map(this.tags, function (tag) {
                    return tag.id;
                })]];
            }
            if (this.get_line_note()) {
                json.note = this.get_line_note();
            }
            if (this.is_return) {
                json.is_return = this.is_return;
            }
            if (this.combo_items && this.combo_items.length) {
                json.combo_item_ids = [[6, false, _.map(this.combo_items, function (item) {
                    return item.id;
                })]];
            }
            if (this.uom_id) {
                json.uom_id = this.uom_id
            }
            if (this.variants && this.variants.length) {
                json.variant_ids = [[6, false, _.map(this.variants, function (variant) {
                    return variant.id;
                })]];
            }
            if (this.discount_reason) {
                json.discount_reason = this.discount_reason
            }
            if (this.medical_insurance) {
                json.medical_insurance = this.medical_insurance
            }
            if (this.frequent_buyer_id) {
                json.frequent_buyer_id = this.frequent_buyer_id
            }
            if (this.packaging) {
                json.packaging_id = this.packaging.id
            }
            if (this.lot_ids) {
                var pack_lot_ids = json.pack_lot_ids;
                for (var i = 0; i < this.lot_ids.length; i++) {
                    var lot = this.lot_ids[i];
                    pack_lot_ids.push([0, 0, {
                        lot_name: lot['name'],
                        quantity: lot['quantity'],
                        lot_id: lot['id']
                    }]);
                }
                json.pack_lot_ids = pack_lot_ids;
            }
            if (this.manager_user) {
                json.manager_user_id = this.manager_user.id
            }
            if (this.pos.config.pos_branch_id) {
                json.pos_branch_id = this.pos.config.pos_branch_id[0]
            }
            return json;
        },
        clone: function () {
            var orderline = _super_Orderline.clone.call(this);
            orderline.note = this.note;
            return orderline;
        },
        set_combo_items: function (combo_item_ids) {
            this.combo_items = [];
            for (var index in combo_item_ids) {
                var combo_item_id = combo_item_ids[index];
                var combo_item = this.pos.combo_item_by_id[combo_item_id];
                if (combo_item) {
                    this.combo_items.push(combo_item)
                }
            }
            this.trigger('change', this)
        },
        set_tags: function (tag_ids) {
            this.tags = [];
            for (var index in tag_ids) {
                var tag_id = tag_ids[index];
                var tag = this.pos.tag_by_id[tag_id];
                if (tag) {
                    this.tags.push(tag)
                }
            }
            this.trigger('change', this)
        },
        set_discount_price: function (price_will_discount, tax) {
            if (tax.include_base_amount) {
                var line_subtotal = this.get_price_with_tax() / this.quantity;
                var tax_before_discount = (line_subtotal - line_subtotal / (1 + tax.amount / line_subtotal));
                var price_before_discount = line_subtotal - tax_before_discount; // b
                var tax_discount = price_will_discount - price_will_discount / (1 + tax.amount / price_will_discount);
                var price_discount = price_will_discount - tax_discount; // d
                var price_exincluded_discount = price_before_discount - price_discount;
                var new_tax_wihtin_discount = price_exincluded_discount - price_exincluded_discount / (1 + tax.amount / price_exincluded_discount);
                var new_price_wihtin_discount = line_subtotal - price_will_discount;
                var new_price_without_tax = new_price_wihtin_discount - new_tax_wihtin_discount;
                var new_price_within_tax = new_price_without_tax + new_tax_wihtin_discount;
                this.set_unit_price(new_price_within_tax);
                this.trigger('change', this);
            } else {
                var tax_discount = tax.amount / 100 * price_will_discount;
                var price_discount = price_will_discount - tax_discount;
                var new_price_within_tax = this.price - price_discount - (0.91 * (parseInt(price_will_discount / 100)));
                this.set_unit_price(new_price_within_tax);
                this.trigger('change', this);
            }
        },
        export_for_printing: function () {
            var receipt_line = _super_Orderline.export_for_printing.apply(this, arguments);
            receipt_line['combo_items'] = [];
            receipt_line['variants'] = [];
            receipt_line['tags'] = [];
            receipt_line['note'] = this.note || '';
            if (this.combo_items) {
                receipt_line['combo_items'] = this.combo_items;
            }
            if (this.variants) {
                receipt_line['variants'] = this.variants;
            }
            if (this.tags) {
                receipt_line['tags'] = this.tags;
            }
            if (this.discount_reason) {
                receipt_line['discount_reason'] = this.discount_reason;
            }
            receipt_line['tax_amount'] = this.get_tax() || 0.00;
            if (this.variants) {
                receipt_line['variants'] = this.variants;
            }
            if (this.packaging) {
                receipt_line['packaging'] = this.packaging;
            }
            return receipt_line;
        },
        get_price_included_tax_by_price_of_item: function (price_unit, quantity) {
            var taxtotal = 0;
            var product = this.get_product();
            var taxes_ids = product.taxes_id;
            var taxes = this.pos.taxes;
            var taxdetail = {};
            var product_taxes = [];

            _(taxes_ids).each(function (el) {
                product_taxes.push(_.detect(taxes, function (t) {
                    return t.id === el;
                }));
            });

            var all_taxes = this.compute_all(product_taxes, price_unit, quantity, this.pos.currency.rounding);
            _(all_taxes.taxes).each(function (tax) {
                taxtotal += tax.amount;
                taxdetail[tax.id] = tax.amount;
            });

            return {
                "priceWithTax": all_taxes.total_included,
                "priceWithoutTax": all_taxes.total_excluded,
                "tax": taxtotal,
                "taxDetails": taxdetail,
            };
        },
        set_unit_price: function (price) {
            var discount_product_id = null;
            if (this.pos.config.discount_product_id) {
                discount_product_id = this.pos.config.discount_product_id[0]
            }
            var self = this;
            if (this.product && (parseFloat(price) < this.product.minimum_list_price) && !this.packaging && !this.promotion && this.product.id != discount_product_id) {
                return this.pos.gui.show_popup('number', {
                    'title': _t('Product have minimum price smaller list price, plese input price need to change'),
                    'value': 0,
                    'confirm': function (price) {
                        return self.set_unit_price(price);
                    }
                })
            } else {
                _super_Orderline.set_unit_price.apply(this, arguments);
            }
        },
        has_valid_product_lot: function () { //  TODO: is line multi lots or not
            if (this.lot_ids && this.lot_ids.length) {
                return true
            } else {
                return _super_Orderline.has_valid_product_lot.apply(this, arguments);
            }
        },
        set_taxes: function (tax_ids) { // TODO: add taxes to order line
            if (this.product) {
                this.product.taxes_id = tax_ids;
                this.trigger('change', this);
            }
        },
        set_variants: function (variant_ids) { // TODO: add variants to order line
            var self = this;
            var sale_price;
            if (this.pos.server_version == 10) {
                sale_price = this.pos.get_price(this.product, this.pos.pricelist); // v10 only
            } else {
                sale_price = this.product.get_price(this.product, this.pos.default_pricelist, this.quantity);
            }
            this.variants = _.map(variant_ids, function (variant_id) {
                var variant = self.pos.variant_by_id[variant_id];
                if (variant) {
                    return variant
                }
            });
            this.price_manually_set = true;
            if (this.variants.length == 0) {
                this.set_unit_price(sale_price);
            } else {
                var price_extra_total = sale_price;
                for (var i = 0; i < this.variants.length; i++) {
                    price_extra_total += this.variants[i].price_extra;
                }
                this.set_unit_price(price_extra_total);
            }
        },
        get_product_price_quantity_item: function () {
            var product_tmpl_id = this.product.product_tmpl_id;
            if (product_tmpl_id instanceof Array) {
                product_tmpl_id = product_tmpl_id[0]
            }
            var product_price_quantities = this.pos.price_each_qty_by_product_tmpl_id[product_tmpl_id];
            if (product_price_quantities) {
                var product_price_quanty_temp = null;
                for (var i = 0; i < product_price_quantities.length; i++) {
                    var product_price_quantity = product_price_quantities[i];
                    if (this.quantity >= product_price_quantity['quantity']) {
                        if (!product_price_quanty_temp) {
                            product_price_quanty_temp = product_price_quantity;
                        } else {
                            if (product_price_quanty_temp['quantity'] <= product_price_quantity['quantity']) {
                                product_price_quanty_temp = product_price_quantity;
                            }
                        }
                    }
                }
                return product_price_quanty_temp;
            }
            return null
        },
        has_variants: function () {
            if (this.variants && this.variants.length && this.variants.length > 0) {
                return true
            } else {
                return false
            }
        },
        set_product_lot: function (product) {
            if (product) { // first install may be have old orders, this is reason made bug
                return _super_Orderline.set_product_lot.apply(this, arguments);
            } else {
                return null
            }
        },
        // if config product tax id: have difference tax of other company
        // but when load data account.tax, pos default only get data of current company
        // and this function return some item undefined
        get_taxes: function () {
            var taxes = _super_Orderline.export_for_printing.apply(this, arguments);
            var new_taxes = [];
            var taxes_ids = this.get_product().taxes_id;
            var taxes = [];
            for (var i = 0; i < taxes_ids.length; i++) {
                if (this.pos.taxes_by_id[taxes_ids[i]]) {
                    new_taxes.push(this.pos.taxes_by_id[taxes_ids[i]]);
                }
            }
            return new_taxes;
        },
        get_packaging: function () {
            if (!this || !this.product || !this.pos.packaging_by_product_id) {
                return false;
            }
            if (this.pos.packaging_by_product_id[this.product.id]) {
                return true
            } else {
                return false
            }
        },
        get_packaging_added: function () {
            if (this.packaging) {
                return this.packaging;
            } else {
                return false
            }
        },
        set_global_discount: function (discount) {
            this.discount_reason = discount.reason;
            this.set_discount(discount.amount);
            this.trigger('change', this);
        },
        set_unit: function (uom_id, price) {
            this.uom_id = uom_id;
            this.trigger('change', this);
            this.trigger('trigger_update_line');
            if (price) {
                this.set_unit_price(price);
            }
            this.price_manually_set = true;
            return true;
        },
        change_unit: function () {
            var self = this;
            var product = this.product;
            var product_tmpl_id;
            if (product.product_tmpl_id instanceof Array) {
                product_tmpl_id = product.product_tmpl_id[0]
            } else {
                product_tmpl_id = product.product_tmpl_id;
            }
            var uom_items = this.pos.uoms_prices_by_product_tmpl_id[product_tmpl_id];
            if (!uom_items) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: product['display_name'] + ' have ' + product['uom_id'][1] + ' only.',
                });
            }
            var list = [];
            for (var i = 0; i < uom_items.length; i++) {
                var item = uom_items[i];
                list.push({
                    'label': item.uom_id[1] + ', at price ' + item['price'],
                    'item': item,
                });
            }
            var base_uom_id = product['base_uom_id'];
            if (base_uom_id) {
                var base_uom = this.pos.uom_by_id[base_uom_id[0]];
                base_uom['price'] = product.list_price;
                base_uom['uom_id'] = base_uom['id'];
                list.push({
                    'label': base_uom['name'] + ', at price ' + base_uom['price'],
                    'item': base_uom
                })
            }
            if (list.length) {
                this.pos.gui.show_popup('selection', {
                    title: _t('Select Unit need to change'),
                    list: list,
                    confirm: function (item) {
                        return self.set_unit(item.uom_id[0], item['price']);
                    }
                });
            } else {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: product['display_name'] + ' only one ' + product['uom_id'][1],
                });
            }
        },
        change_combo: function () {
            var line = this;
            var combo_items = _.filter(this.pos.combo_items, function (combo_item) {
                return combo_item.product_combo_id[0] == line.product.product_tmpl_id || combo_item.product_combo_id[0] == line.product.product_tmpl_id[0]
            });
            if (combo_items.length) {
                this.pos.gui.show_popup('popup_selection_combos', {
                    title: 'Please choice items',
                    combo_items: combo_items,
                    selected_orderline: this
                });
            } else {
                this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Product is combo but have not set combo items',
                });
            }
        },
        change_cross_selling: function () {
            var self = this;
            var cross_items = _.filter(this.pos.cross_items, function (cross_item) {
                return cross_item['product_tmpl_id'][0] == self.product.product_tmpl_id;
            });
            if (cross_items.length) {
                this.pos.gui.show_popup('popup_cross_selling', {
                    widget: this,
                    cross_items: cross_items
                });
            } else {
                this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'You not active cross selling or product have not items cross selling'
                });
            }
        },
        get_sale_person: function () {
            return this.seller || null
        },
        get_number_of_order: function () {
            var uid = this.uid;
            var order = this.order;
            for (var i = 0; i < order.orderlines.models.length; i++) {
                var line = order.orderlines.models[i];
                if (line.uid == uid) {
                    return i + 1
                }
            }
        },
        set_sale_person: function (seller) {
            if (this.pos.config.force_seller) {
                var order = this.order;
                _.each(order.orderlines.models, function (line) {
                    line.seller = seller;
                    line.trigger('change', line);
                });
                order.seller = seller;
            } else {
                this.seller = seller;
                this.trigger('change', this);
            }
            this.order.trigger('change', this.order);
        },
        get_price_without_quantity: function () {
            if (this.quantity != 0) {
                return this.get_price_with_tax() / this.quantity
            } else {
                return 0
            }
        },
        get_line_image: function () { // show image on receipt and orderlines
            return window.location.origin + '/web/image?model=product.product&field=image_medium&id=' + this.product.id;
        },
        // ------------- **** --------------------------------------
        // when cashiers select line, auto pop-up cross sell items
        // or if product have suggestion items, render element show all suggestion items
        // ------------- **** --------------------------------------
        show_cross_sale: function () {
            var cross_items = _.filter(this.pos.cross_items, function (cross_item) {
                return cross_item['product_tmpl_id'][0] == product_tmpl_id;
            });
            if (cross_items.length) {
                this.pos.gui.show_popup('popup_cross_selling', {
                    widget: this,
                    cross_items: cross_items
                });
            }
        },
        is_has_tags: function () {
            if (!this.tags || this.tags.length == 0) {
                return true
            } else {
                return false
            }
        },
        is_multi_variant: function () {
            var variants = this.pos.variant_by_product_tmpl_id[this.product.product_tmpl_id];
            if (!variants) {
                return false
            }
            if (variants.length > 0) {
                return true;
            } else {
                return false;
            }
        },
        get_price_discount: function () { // method return discount amount of pos order lines gui
            var price = this.get_unit_price() * (1.0 - (this.get_discount() / 100.0));
            var base_price = this.get_unit_price();
            return (base_price - price) * this.quantity
        },
        get_unit: function () {
            if (!this.uom_id) {
                var unit = _super_Orderline.get_unit.apply(this, arguments);
                return unit;
            } else {
                var unit_id = this.uom_id;
                var unit = this.pos.units_by_id[unit_id];
                return unit;
            }
        },
        is_multi_unit_of_measure: function () {
            var uom_items = this.pos.uoms_prices_by_product_tmpl_id[this.product.product_tmpl_id];
            if (!uom_items) {
                return false;
            }
            if (uom_items.length > 0) {
                return true;
            } else {
                return false;
            }
        },
        is_combo: function () {
            var combo_items = [];
            for (var i = 0; i < this.pos.combo_items.length; i++) {
                var combo_item = this.pos.combo_items[i];
                if (combo_item.product_combo_id[0] == this.product['product_tmpl_id']) {
                    combo_items.push(combo_item);
                }
            }
            if (combo_items.length > 0) {
                return true
            } else {
                return false;
            }
        },
        has_combo_item_tracking_lot: function () {
            var tracking = false;
            for (var i = 0; i < this.pos.combo_items.length; i++) {
                var combo_item = this.pos.combo_items[i];
                if (combo_item['tracking']) {
                    tracking = true;
                }
            }
            return tracking;
        },
        set_quantity: function (quantity, keep_price) {
            if (this.uom_id || this.redeem_point) {
                keep_price = 'keep price because changed uom id or have redeem point'
            }
            if (this.pos.the_first_load == false && quantity != 'remove' && this.pos.config['allow_order_out_of_stock'] == false && quantity && quantity != 'remove' && this.order.syncing != true && this.product['type'] != 'service') {
                var current_qty = 0
                for (var i = 0; i < this.order.orderlines.models.length; i++) {
                    var line = this.order.orderlines.models[i];
                    if (this.product.id == line.product.id && line.id != this.id) {
                        current_qty += line.quantity
                    }
                }
                current_qty += parseFloat(quantity);
                if (current_qty > this.product['qty_available'] && this.product['type'] == 'product') {
                    var product = this.pos.db.get_product_by_id(this.product.id);
                    this.pos.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: product['name'] + ' quantity on hand is 0, blocked sale it.',
                    });
                }
            }
            var res = _super_Orderline.set_quantity.call(this, quantity, keep_price); // call style change parent parameter : keep_price
            if (this.combo_items && this.pos.config.screen_type != 'kitchen') { // if kitchen screen, no need reset combo items
                this.trigger('change', this);
            }
            var get_product_price_quantity = this.get_product_price_quantity_item(); // product price filter by quantity of cart line. Example: buy 1 unit price 1, buy 10 price is 0.5
            if (get_product_price_quantity) {
                this.set_unit_price(get_product_price_quantity['price_unit']);
            }
            var order = this.order;
            var orderlines = order.orderlines.models;
            if (!order.fiscal_position || orderlines.length != 0) {
                for (var i = 0; i < orderlines.length; i++) { // reset taxes_id of line
                    orderlines[i]['taxes_id'] = [];
                }
            }
            if (order.fiscal_position && orderlines.length) {
                var fiscal_position = order.fiscal_position;
                var fiscal_position_taxes_by_id = fiscal_position.fiscal_position_taxes_by_id
                if (fiscal_position_taxes_by_id) {
                    for (var number in fiscal_position_taxes_by_id) {
                        var fiscal_tax = fiscal_position_taxes_by_id[number];
                        var tax_src_id = fiscal_tax.tax_src_id;
                        var tax_dest_id = fiscal_tax.tax_dest_id;
                        if (tax_src_id && tax_dest_id) {
                            for (var i = 0; i < orderlines.length; i++) { // reset taxes_id of line
                                orderlines[i]['taxes_id'] = [];
                            }
                            for (var i = 0; i < orderlines.length; i++) { // append taxes_id of line
                                var line = orderlines[i];
                                var product = line.product;
                                var taxes_id = product.taxes_id;
                                for (var number in taxes_id) {
                                    var tax_id = taxes_id[number];
                                    if (tax_id == tax_src_id[0]) {
                                        orderlines[i]['taxes_id'].push(tax_dest_id[0]);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    for (var i = 0; i < orderlines.length; i++) { // reset taxes_id of line
                        orderlines[i]['taxes_id'] = [];
                    }
                }
            }
            return res;
        },
        get_line_note: function (note) {
            return this.note;
        },
        can_be_merged_with: function (orderline) {
            var merge = _super_Orderline.can_be_merged_with.apply(this, arguments);
            var current_price = this.price;
            var line_add_price;
            if (this.pos.server_version == 10) {
                line_add_price = this.price;
            }
            if ([11, 12].indexOf(this.pos.server_version) != -1) {
                line_add_price = orderline.get_product().get_price(orderline.order.pricelist, this.get_quantity());
            }
            var current_price_round = round_pr(Math.max(0, current_price), this.pos.currency.rounding);
            var line_add_price_round = round_pr(Math.max(0, line_add_price), this.pos.currency.rounding);
            if (orderline.get_line_note() !== this.get_line_note()) {
                return false;
            }
            if (current_price != line_add_price && current_price_round == line_add_price_round) {
                if (this.get_product().id !== orderline.get_product().id) {
                    return false;
                } else if (!this.get_unit() || !this.get_unit().is_pos_groupable) {
                    return false;
                } else if (this.get_product_type() !== orderline.get_product_type()) {
                    return false;
                } else if (this.get_discount() > 0) {
                    return false;
                } else if (this.product.tracking == 'lot') {
                    return false;
                } else {
                    return true;
                }
            }
            if (orderline['combo_items'] || orderline.product.is_combo || orderline.is_return) {
                return false;
            }
            return merge
        },
    });
});
