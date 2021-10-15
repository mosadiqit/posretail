odoo.define('pos_retail.popups', function (require) {

    var core = require('web.core');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('pos.rpc');
    var qweb = core.qweb;
    var utils = require('web.utils');
    var round_pr = utils.round_precision;

    var popup_selection_combos = PopupWidget.extend({ // select combo
        template: 'popup_selection_combos',
        show: function (options) {
            // options.combo_items: combo if product selected
            // options.selected_orderline: line selected
            var self = this;
            this.options = options;
            var combo_items = options.combo_items;
            var selected_orderline = options.selected_orderline;
            var combo_items_selected = selected_orderline['combo_items'];
            for (var i = 0; i < combo_items.length; i++) {
                var combo_line = combo_items[i];
                var combo_line_selected = _.find(combo_items_selected, function (line) {
                    return line.id == combo_line.id;
                });
                if (combo_line_selected) {
                    combo_line['selected'] = true;
                } else {
                    combo_line['selected'] = false;
                }
            }
            this._super(options);
            this.combo_items = selected_orderline['combo_items'];
            this.$el.find('.card-content').html(qweb.render('combo_items', {
                combo_items: combo_items,
                widget: self
            }));
            this.$('.selection-item').click(function () {
                var combo_item_id = parseInt($(this).data('id'));
                var combo_item = self.pos.combo_item_by_id[combo_item_id];
                if (combo_item) {
                    if ($(this).closest('.selection-item').hasClass("item-selected") == true) {
                        $(this).closest('.selection-item').toggleClass("item-selected");
                        for (var i = 0; i < self.combo_items.length; ++i) {
                            if (self.combo_items[i].id == combo_item.id) {
                                self.combo_items.splice(i, 1);
                                if (combo_item['price_extra']) {
                                    var price_with_tax = selected_orderline.get_price_with_tax();
                                    var price_unit = selected_orderline.get_unit_price();
                                    if (price_unit * selected_orderline.get_quantity() == price_with_tax) {
                                        var price_taxes = selected_orderline.get_price_included_tax_by_price_of_item(combo_item['price_extra'], combo_item['quantity']);
                                        var new_price = price_with_tax - (price_taxes['priceWithTax'] * combo_item['quantity'] * selected_orderline.get_quantity());
                                        var price_apply = selected_orderline.get_price_included_tax_by_price_of_item(new_price, 1)['priceWithTax'] / selected_orderline.get_quantity();
                                        selected_orderline.set_unit_price(price_apply);
                                    } else {
                                        var price_unit = selected_orderline.get_price_without_tax();
                                        var price_apply = (price_unit - (combo_item['price_extra'] * combo_item['quantity'] * selected_orderline.get_quantity())) / selected_orderline.get_quantity();
                                        selected_orderline.set_unit_price(price_apply);
                                    }

                                }
                                selected_orderline.trigger('change', selected_orderline);
                                selected_orderline.trigger('trigger_update_line');
                            }
                        }
                    } else {
                        $(this).closest('.selection-item').toggleClass("item-selected");
                        if (combo_item['price_extra']) {
                            var price_with_tax = selected_orderline.get_price_with_tax();
                            var price_unit = selected_orderline.get_unit_price();
                            if (price_unit * selected_orderline.get_quantity() == price_with_tax) {
                                var price_taxes = selected_orderline.get_price_included_tax_by_price_of_item(combo_item['price_extra'], combo_item['quantity']);
                                var new_price = price_with_tax + (price_taxes['priceWithTax'] * combo_item['quantity'] * selected_orderline.get_quantity());
                                var price_apply = selected_orderline.get_price_included_tax_by_price_of_item(new_price, 1)['priceWithTax'] / selected_orderline.get_quantity();
                                selected_orderline.set_unit_price(price_apply);
                            } else {
                                var price_unit = selected_orderline.get_price_without_tax();
                                var price_apply = (price_unit + (combo_item['price_extra'] * combo_item['quantity'] * selected_orderline.get_quantity())) / selected_orderline.get_quantity();
                                selected_orderline.set_unit_price(price_apply);
                            }

                        }
                        self.combo_items.push(combo_item);
                        selected_orderline.trigger('change', selected_orderline);
                        selected_orderline.trigger('trigger_update_line');
                    }

                }
                var order = self.pos.get('selectedOrder');
                order.trigger('change', order)
            });
            $('.cancel').click(function () {
                self.gui.close_popup();
            });
        }
    });
    gui.define_popup({name: 'popup_selection_combos', widget: popup_selection_combos});

    // add lot to combo items
    var popup_add_lot_to_combo_items = PopupWidget.extend({
        template: 'popup_add_lot_to_combo_items',
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .remove-lot': 'remove_lot',
            'blur .packlot-line-input': 'lose_input_focus'
        }),

        show: function (options) {
            this.orderline = options.orderline;
            this.combo_items = options.combo_items;
            this._super(options);
            this.focus();
        },
        lose_input_focus: function (ev) {
            var $input = $(ev.target),
                id = $input.attr('id');
            var combo_item = this.pos.combo_item_by_id[id];
            var lot = this.pos.lot_by_name[$input.val()];
            if (lot) {
                combo_item['use_date'] = lot['use_date']
            } else {
                combo_item['lot_number'] = 'Wrong lot, input again.';
            }
            for (var i = 0; i < this.orderline.combo_items.length; i++) {
                if (this.orderline.combo_items[i]['id'] == id) {
                    this.orderline.combo_items[i] = combo_item;
                }
            }
            this.orderline.trigger('change', this.orderline);
        },
        remove_lot: function (ev) {
            $input = $(ev.target).prev(),
                id = $input.attr('id');
            var combo_item = this.pos.combo_item_by_id[id];
            combo_item['lot_number'] = '';
            combo_item['use_date'] = '';
            for (var i = 0; i < this.orderline.combo_items.length; i++) {
                if (this.orderline.combo_items[i]['id'] == id) {
                    this.orderline.combo_items[i] = combo_item;
                }
            }
            this.orderline.trigger('change', this.orderline);
            this.renderElement();
        },

        focus: function () {
            this.$("input[autofocus]").focus();
            this.focus_model = false;   // after focus clear focus_model on widget
        }
    });
    gui.define_popup({name: 'popup_add_lot_to_combo_items', widget: popup_add_lot_to_combo_items});

    var popup_internal_transfer = PopupWidget.extend({ // internal transfer
        template: 'popup_internal_transfer',

        show: function (options) {
            var self = this;
            if (this.pos.stock_locations.length == 0) {
                return this.gui.show_popup('dialog', {
                    'title': 'Warning',
                    'body': 'Your stock locations have not any location checked to checkbox [Available in POS]. Please back to backend and config it'
                })
            }
            this._super(options);
            this.$('.datetimepicker').datetimepicker({
                format: 'YYYY-MM-DD H:mm:00',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });
            this.$('.confirm').click(function () {
                self.click_confirm();
            });
            this.$('.cancel').click(function () {
                self.pos.gui.close_popup();
            });
        },

        click_confirm: function () {
            var self = this;
            var fields = {};
            this.$('.internal_transfer_field').each(function (idx, el) {
                fields[el.id] = el.value || false;
            });
            if (!fields['scheduled_date']) {
                return self.wrong_input('input[id="scheduled_date"]', 'Scheduled date is required');
            } else {
                self.passed_input('input[id="scheduled_date"]');
            }
            var order = this.pos.get_order();
            var length = order.orderlines.length;
            var picking_vals = {
                origin: order['name'],
                picking_type_id: parseInt(fields['picking_type_id']),
                location_id: parseInt(fields['location_id']),
                location_dest_id: parseInt(fields['location_dest_id']),
                move_type: fields['move_type'],
                note: fields['note'],
                move_lines: [],
                scheduled_date: fields['scheduled_date']
            };
            for (var i = 0; i < length; i++) {
                var line = order.orderlines.models[i];
                var product = this.pos.db.get_product_by_id(line.product.id);
                if (product['uom_po_id'] == undefined || !product['uom_po_id']) {
                    return this.pos.gui.show_popup('dialog', {
                        title: 'Error',
                        body: product['display_name'] + ' not set purchase unit, could not create PO'
                    });
                }
                if (product['type'] == 'service') {
                    return this.pos.gui.show_popup('dialog', {
                        title: 'Error',
                        body: product['display_name'] + ' type is service, please remove line',
                        confirmButtonText: 'Yes'
                    });
                }
                if (product['type'] != 'service' && product['uom_po_id'] != undefined) {
                    picking_vals['move_lines'].push([0, 0, {
                        name: order.name,
                        product_uom: product['uom_po_id'][0],
                        picking_type_id: parseInt(fields['picking_type_id']),
                        product_id: line.product.id,
                        product_uom_qty: line.quantity,
                        location_id: parseInt(fields['location_id']),
                        location_dest_id: parseInt(fields['location_dest_id']),
                    }])
                }
            }
            if (picking_vals['move_lines'].length > 0) {
                return rpc.query({
                    model: 'stock.picking',
                    method: 'pos_made_internal_transfer',
                    args: [picking_vals],
                    context: {}
                }, {shadow: true}).then(function (picking_id) {
                    self.pos.get_order().destroy();
                    self.link = window.location.origin + "/web#id=" + picking_id + "&view_type=form&model=stock.picking";
                    return self.gui.show_popup('confirm', {
                        title: 'Done',
                        body: 'Are you want review internal transfer just created ?',
                        confirm: function () {
                            window.open(self.link, '_blank');
                        }
                    });
                }).fail(function (error) {
                    return self.pos.query_backend_fail(error);
                });
            }
        }
    });

    gui.define_popup({name: 'popup_internal_transfer', widget: popup_internal_transfer});

    var popup_account_invoice_refund = PopupWidget.extend({
        template: 'popup_account_invoice_refund',
        show: function (options) {
            var self = this;
            options = options || {};
            this.options = options;
            this._super(options);
            $('.datetimepicker').datetimepicker({
                format: 'YYYY-MM-DD H:mm:00',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }

            });
            $('.datepicker').datetimepicker({
                format: 'YYYY-MM-DD',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });

            $('.timepicker').datetimepicker({
                //          format: 'H:mm',    // use this format if you want the 24hours timepicker
                format: 'H:mm:00', //use this format if you want the 12hours timpiecker with AM/PM toggle
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });
            $('.confirm').click(function () {
                self.click_confirm();
            });
            $('.cancel').click(function () {
                self.pos.gui.close_popup();
            });
        },
        click_confirm: function () {
            var fields = {};
            this.$('.field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields['filter_refund']) {
                return this.wrong_input('input[name="filter_refund"]', '(*) Refund method is required');
            } else {
                this.passed_input('input[name="filter_refund"]')
            }
            if (!fields['description']) {
                return this.wrong_input('input[name="description"]', '(*) Reason refund is required');
            } else {
                this.passed_input('input[name="description"]');
            }
            if (!fields['date_invoice']) {
                return this.wrong_input('input[name="date_invoice"]', '(*) Credit Note Date is required');
            } else {
                this.passed_input('input[name="date_invoice"]')
            }
            if (!fields['date']) {
                return this.wrong_input('input[name="date"]', '(*) Accounting Note Date is required');
            } else {
                this.passed_input('input[name="date"]')
            }
            this.pos.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, this.options.invoice['id'], fields);
            }
        }
    });
    gui.define_popup({name: 'popup_account_invoice_refund', widget: popup_account_invoice_refund});

    // create purchase order (PO)
    var popup_create_purchase_order = PopupWidget.extend({ // create purchase order
        template: 'popup_create_purchase_order',
        init: function (parent, options) {
            this._super(parent, options);
        },
        show: function (options) {
            var self = this;
            options = options || {};
            if (options.cashregisters) {
                this.cashregisters = options.cashregisters;
            }
            this._super(options);
            this.signed = false;
            this.$(".pos_signature").jSignature();
            this.$(".pos_signature").bind('change', function (e) {
                self.signed = true;
            });
            this.$('.datetimepicker').datetimepicker({
                format: 'YYYY-MM-DD H:mm:00',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });
            var order = this.pos.get_order();
            var lines = order.get_orderlines();
            var self = this
            if (lines.length == 0) {
                return this.gui.show_popup('dialog', {
                    title: 'ERROR',
                    body: 'Current order have empty lines, please add products before create the purchase order',
                });
            }
            if (!order.get_client()) {
                return self.pos.gui.show_screen('clientlist');
            }
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.create-purchase-order').click(function () {
                self.create_po();
            });
            this.$('.cancel').click(function () {
                self.pos.gui.close_popup();
            });
        },
        create_po: function () { // check v10
            var fields = {};
            this.$('.po-field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields['date_planned']) {
                return this.wrong_input('input[name="date_planned"]', '(*) Scheduled Date is required');
            } else {
                this.passed_input('input[name="date_planned"]');
            }
            var self = this;
            var order = this.pos.get_order();
            var lines = order.get_orderlines();
            var client = this.pos.get_client();
            var values = {
                journal_id: parseInt(fields['journal_id']),
                origin: order.name,
                partner_id: this.pos.get_client().id,
                order_line: [],
                payment_term_id: client['property_payment_term_id'] && client['property_payment_term_id'][0],
                date_planned: fields['date_planned'],
                note: fields['note'],
                currency_id: parseInt(fields['currency_id'])
            };
            var sign_datas = this.$(".pos_signature").jSignature("getData", "image");
            if (sign_datas && sign_datas[1]) {
                values['signature'] = sign_datas[1]
            }
            if (this.pos.config.create_purchase_order_required_signature && !self.signed) {
                return this.wrong_input('div[name="pos_signature"]', '(*) Required Signature');
            }
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var uom_id;
                if (line['uom_id']) {
                    uom_id = line['uom_id']
                } else {
                    uom_id = line.product.uom_id[0]
                }
                var taxes_id = [[6, false, line.product['supplier_taxes_id'] || []]];
                values['order_line'].push([0, 0, {
                    product_id: line.product['id'],
                    name: line.product['display_name'],
                    product_qty: line['quantity'],
                    product_uom: uom_id,
                    price_unit: line.price,
                    date_planned: new Date(),
                    taxes_id: taxes_id
                }])
            }
            this.pos.gui.close_popup();
            return rpc.query({
                model: 'purchase.order',
                method: 'create_po',
                args:
                    [values, this.pos.config.purchase_order_state]
            }, {shadow: true}).then(function (result) {
                self.pos.get_order().destroy();
                var link = window.location.origin + "/web#id=" + result['id'] + "&view_type=form&model=purchase.order";
                self.link = link;
                return self.gui.show_popup('confirm', {
                    title: 'Done',
                    body: 'Are you want review purchase order ' + result['name'] + ' just created',
                    confirm: function () {
                        window.open(self.link, '_blank');
                    },
                });
            }).fail(function (error) {
                return self.pos.query_backend_fail(error);
            });
        }
    });
    gui.define_popup({
        name: 'popup_create_purchase_order',
        widget: popup_create_purchase_order
    });

    // TODO: return products from sale order
    var popup_stock_return_picking = PopupWidget.extend({
        template: 'popup_stock_return_picking',
        show: function (options) {
            var self = this;
            this.sale = options.sale;
            this.move_lines = this.pos.db.lines_sale_by_id[this.sale['id']];
            this._super(options);
            var image_url = window.location.origin + '/web/image?model=product.product&field=image_medium&id=';
            this.$('.cancel').click(function () {
                self.pos.gui.close_popup();
            });
            if (!this.move_lines) {
                return this.gui.show_popup('error', {
                    title: 'Error',
                    body: 'Order have not any lines'
                })
            }
            if (this.move_lines) {
                this.$el.find('tbody').html(qweb.render('stock_move_line', {
                    move_lines: self.move_lines,
                    image_url: image_url,
                    widget: self
                }));
                this.$('.line-select').click(function () {
                    var line_id = parseInt($(this).data('id'));
                    var line = self.pos.db.sale_line_by_id[line_id];
                    var checked = this.checked;
                    if (checked == false) {
                        for (var i = 0; i < self.move_lines.length; ++i) {
                            if (self.move_lines[i].id == line.id) {
                                self.move_lines.splice(i, 1);
                            }
                        }
                    } else {
                        self.move_lines.push(line);
                    }
                });
                this.$('.confirm').click(function () {
                    self.pos.gui.close_popup();
                    if (self.move_lines.length == 0) {
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Please select line for return'
                        })
                    }
                    if (self.sale.picking_ids.length == 0) {
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Sale order have not delivery order, could not made return'
                        })
                    }
                    if (self.sale.picking_ids.length > 1) {
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Sale order have delivery orders bigger than 2, could not made return'
                        })
                    }
                    if (self.sale.picking_ids.length == 1) {
                        return rpc.query({
                            model: 'stock.return.picking',
                            method: 'default_get',
                            args: [['product_return_moves', 'move_dest_exists', 'parent_location_id', 'original_location_id', 'location_id']],
                            context: {
                                active_ids: [self.sale.picking_ids[0]],
                                active_id: self.sale.picking_ids[0]
                            }
                        }).then(function (default_vals) {
                            var product_return_moves = default_vals['product_return_moves'];
                            var product_return_ids = [];
                            for (var i = 0; i < self.move_lines.length; i++) {
                                product_return_ids.push(self.move_lines[i]['product_id'][0])
                            }
                            if (product_return_moves) {
                                product_return_moves = _.filter(product_return_moves, function (move_return) {
                                    var product_index = _.findIndex(product_return_ids, function (id) {
                                        return id == move_return[2]['product_id'];
                                    });
                                    if (product_index != -1) {
                                        return true
                                    }
                                });
                                default_vals['product_return_moves'] = product_return_moves;
                                return rpc.query({
                                    model: 'stock.return.picking',
                                    method: 'create',
                                    args: [default_vals],
                                }).then(function (return_picking_id) {
                                    self.return_picking_id = return_picking_id;
                                    return rpc.query({
                                        model: 'stock.return.picking',
                                        method: 'create_returns',
                                        args: [[return_picking_id]],
                                    }).then(function (result) {
                                        return rpc.query({
                                            model: 'sale.order',
                                            method: 'action_validate_picking',
                                            args:
                                                [[self.sale['id']]],
                                            context: {
                                                pos: true
                                            }
                                        }).then(function (picking_name) {
                                            if (picking_name) {
                                                return self.pos.gui.show_popup('dialog', {
                                                    title: 'Succeed',
                                                    body: 'Return Delivery Order ' + picking_name + ' processed to Done',
                                                });
                                            } else {
                                                return self.pos.gui.show_popup('dialog', {
                                                    title: 'Warning',
                                                    body: 'Have not any delivery order of this sale order',
                                                });
                                            }
                                        }).fail(function (error) {
                                            return self.pos.query_backend_fail(error);
                                        })
                                    }).fail(function (error) {
                                        return self.pos.query_backend_fail(error);
                                    })
                                }).fail(function (error) {
                                    return self.pos.query_backend_fail(error);
                                })
                            }
                            return self.pos.gui.close_popup();
                        }).fail(function (error) {
                            return self.pos.query_backend_fail(error);
                        })
                    }
                });
            }
        }
    });
    gui.define_popup({
        name: 'popup_stock_return_picking',
        widget: popup_stock_return_picking
    });

    var popup_selection_tags = PopupWidget.extend({ // add tags
        template: 'popup_selection_tags',
        show: function (options) {
            var self = this;
            this._super(options);
            var tags = this.pos.tags;
            this.tags_selected = {};
            var selected_orderline = options.selected_orderline;
            var tag_selected = selected_orderline['tags'];
            for (var i = 0; i < tags.length; i++) {
                var tag = _.findWhere(tag_selected, {id: tags[i].id});
                if (tag) {
                    self.tags_selected[tag.id] = tags[i];
                    tags[i]['selected'] = true
                } else {
                    tags[i]['selected'] = false
                }
            }
            self.$el.find('.body').html(qweb.render('tags_list', {
                tags: tags,
                widget: self
            }));

            $('.tag').click(function () {
                var tag_id = parseInt($(this).data('id'));
                var tag = self.pos.tag_by_id[tag_id];
                if (tag) {
                    if ($(this).closest('.tag').hasClass("item-selected") == true) {
                        $(this).closest('.tag').toggleClass("item-selected");
                        delete self.tags_selected[tag.id];
                        self.remove_tag_out_of_line(selected_orderline, tag)
                    } else {
                        $(this).closest('.tag').toggleClass("item-selected");
                        self.tags_selected[tag.id] = tag;
                        self.add_tag_to_line(selected_orderline, tag)
                    }
                }
            });
            $('.close').click(function () {
                self.pos.gui.close_popup();
            });
        },
        add_tag_to_line: function (line, tag_new) {
            if (!line.tags) {
                line.tags = []
            }
            line.tags.push(tag_new);
            line.trigger('change', line);
            line.trigger_update_line();
        },
        remove_tag_out_of_line: function (line, tag_new) {
            var tag_exist = _.filter(line.tags, function (tag) {
                return tag['id'] !== tag_new['id'];
            });
            line.tags = tag_exist;
            line.trigger('change', line);
            line.trigger_update_line();
        }
    });
    gui.define_popup({name: 'popup_selection_tags', widget: popup_selection_tags});

    var popup_print_receipt = PopupWidget.extend({
        template: 'popup_print_receipt',
        show: function (options) {
            options = options || {};
            this.options = options;
            this._super(options);
            var contents = this.$el[0].querySelector('.xml');
            var tbody = document.createElement('tbody');
            tbody.innerHTML = options.xml;
            tbody = tbody.childNodes[1];
            contents.appendChild(tbody);
            var self = this;
            setTimeout(function () {
                self.pos.gui.close_popup();
            }, 5000);
        }
    });
    gui.define_popup({name: 'popup_print_receipt', widget: popup_print_receipt});

    var popup_add_order_line_note = PopupWidget.extend({
        template: 'popup_add_order_line_note',
        show: function (options) {
            var self = this;
            options = options || {};
            options.notes = this.pos.notes;
            this._super(options);
            this.renderElement();
            this.notes_selected = {};
            this.$('input,textarea').focus();
            $('.note').click(function () {
                var note_id = parseInt($(this).data('id'));
                var note = self.pos.note_by_id[note_id];
                self.pos.get_order().get_selected_orderline().set_line_note(note['name']);
                self.pos.gui.close_popup();
            });
            $('.confirm').click(function () {
                self.click_confirm();
            });
            $('.cancel').click(function () {
                self.gui.close_popup();
            });
        },
        click_confirm: function () {
            var value = this.$('input,textarea').val();
            this.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, value);
            }
        }
    });
    gui.define_popup({name: 'popup_add_order_line_note', widget: popup_add_order_line_note});

    var popup_cross_selling = PopupWidget.extend({ // popup cross selling
        template: 'popup_cross_selling',
        show: function (options) {
            var self = this;
            this._super(options);
            var cross_items = options.cross_items;
            this.cross_items_selected = [];
            var image_url = window.location.origin + '/web/image?model=product.product&field=image_medium&id=';
            self.$el.find('div.body').html(qweb.render('cross_item', {
                cross_items: cross_items,
                image_url: image_url,
                widget: this
            }));
            $('.combo-item').click(function () {
                var cross_item_id = parseInt($(this).data('id'));
                var cross_item = self.pos.cross_item_by_id[cross_item_id];
                if (cross_item) {
                    if ($(this).closest('.left_button').hasClass("item-selected") == true) {
                        $(this).closest('.left_button').toggleClass("item-selected");
                        self.cross_items_selected = _.filter(self.cross_items_selected, function (cross_item_selected) {
                            return cross_item_selected['id'] != cross_item['id']
                        })
                    } else {
                        $(this).closest('.left_button').toggleClass("item-selected");
                        self.cross_items_selected.push(cross_item)
                    }

                }
            });
            $('.cancel').click(function () {
                self.gui.close_popup();
            });
            $('.add_cross_selling').click(function () {
                self.pos.gui.show_popup('dialog', {
                    title: 'Done',
                    body: 'Cross items selected just added to order',
                    color: 'info'
                });
                var order = self.pos.get_order();
                if (self.cross_items_selected.length == 0) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Please click and choice product item'
                    });
                }
                if (order) {
                    for (var i = 0; i < self.cross_items_selected.length; i++) {
                        var cross_item = self.cross_items_selected[i];
                        var product = self.pos.db.get_product_by_id(cross_item['product_id'][0]);
                        if (product) {
                            if (!product) {
                                continue
                            }
                            var price = cross_item['list_price'];
                            if (cross_item['discount_type'] == 'percent') {
                                price = price - price / 100 * cross_item['discount']
                            }
                            order.add_product(product, {
                                quantity: cross_item['quantity'],
                                price: price,
                                merge: false,
                            });
                        }
                    }
                    return true;
                }
            });
        }
    });
    gui.define_popup({name: 'popup_cross_selling', widget: popup_cross_selling});

    var popup_order_signature = PopupWidget.extend({
        template: 'popup_order_signature',
        init: function (parent, options) {
            this._super(parent, options);
        },
        show: function (options) {
            var self = this;
            this._super(options);
            this.signed = false;
            this.$(".pos_signature").jSignature();
            this.$(".pos_signature").bind('change', function (e) {
                self.signed = true;
            });
            this.$('.confirm').click(function () {
                if (!self.signed) {
                    return self.wrong_input('div[name="pos_signature"]', '(*) Please signature before confirm')
                }
                var order = self.pos.get_order();
                var sign_datas = self.$(".pos_signature").jSignature("getData", "image");
                if (sign_datas.length > 1) {
                    order.set_signature(sign_datas[1])
                }
                self.click_confirm();
            })
            this.$('.cancel').click(function () {
                self.click_cancel();
            })
        }
    });
    gui.define_popup({
        name: 'popup_order_signature',
        widget: popup_order_signature
    });

    var notify_popup = PopupWidget.extend({
        template: 'dialog',
        show: function (options) {
            this.show_notification(options.from, options.align, options.title, options.body, options.timer, options.color)
        },
        show_notification: function (from, align, title, body, timer, color) {
            var self = this;
            if (!from) {
                from = 'right';
            }
            if (!align) {
                align = 'top';
            }
            if (!title) {
                title = 'Message'
            }
            if (!timer) {
                timer = 100;
            }
            if (!color) {
                color = 'danger'
            }
            if (!color) {
                var type = ['info', 'success', 'warning', 'danger', 'rose', 'primary'];
                var random = Math.floor((Math.random() * 6) + 1);
                color = type[random];
            }
            $.notify({
                icon: "notifications",
                message: "<b>" + title + "</b> - " + body

            }, {
                type: color,
                timer: timer,
                placement: {
                    from: from,
                    align: align
                }
            });
            this.pos.gui.close_popup();
        }
    });
    gui.define_popup({name: 'dialog', widget: notify_popup});


    var alert_input = PopupWidget.extend({
        template: 'alert_input',
        show: function (options) {
            options = options || {};
            this._super(options);
            this.renderElement();
            this.$('input').focus();
        },
        click_confirm: function () {
            var value = this.$('input').val();
            this.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, value);
            }
        },
    });
    gui.define_popup({name: 'alert_input', widget: alert_input});


    var popup_set_guest = PopupWidget.extend({
        template: 'popup_set_guest',
        show: function (options) {
            var self = this;
            options = options || {};
            this._super(options);
            this.renderElement();
            this.$('.confirm').click(function () {
                self.click_confirm();
            });
            this.$('.cancel').click(function () {
                self.click_cancel();
            });
        },
        click_confirm: function () {
            var fields = {};
            this.$('.guest_field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields['guest']) {
                return this.wrong_input("input[name='guest']", "(*) Guest name is Blank");
            } else {
                this.passed_input("input[name='guest']")
            }
            if (!fields['guest_number']) {
                return this.wrong_input("input[name='number']", "(*) Guest Number is Blank");
            } else {
                this.passed_input("input[name='guest']")
            }
            this.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, fields);
            }
        },
    });

    gui.define_popup({name: 'popup_set_guest', widget: popup_set_guest});

    var ask_password = PopupWidget.extend({
        template: 'ask_password',
        show: function (options) {
            options = options || {};
            this._super(options);
            this.renderElement();
        },
        click_confirm: function () {
            var value = this.$('input').val();
            this.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, value);
            }
        }
    });

    gui.define_popup({name: 'ask_password', widget: ask_password});

    _.each(gui.Gui.prototype.popup_classes, function (popup) {
        if (popup.name == 'packlotline') {
            var packlotline_widget = popup.widget;
            packlotline_widget.include({
                show: function (options) {
                    this._super(options);
                    var order = this.pos.get_order();
                    if (order) {
                        var selected_line = order.get_selected_orderline();
                        var lots = this.pos.lot_by_product_id[selected_line.product.id];
                        if (lots) {
                            var lots_auto_complete = [];
                            for (var i = 0; i < lots.length; i++) {
                                lots_auto_complete.push({
                                    value: lots[i]['name'],
                                    label: lots[i]['name']
                                })
                            }
                            var self = this;
                            var $input_lot = $('.packlot-lines  >input');
                            $input_lot.autocomplete({
                                source: lots_auto_complete,
                                minLength: this.pos.config.min_length_search,
                                select: function (event, item_selected) {
                                    if (item_selected && item_selected['item'] && item_selected['item']['value']) {
                                        var lot = self.pos.lot_by_name[item_selected['item']['value']];
                                        if (lot && lot.replace_product_public_price && lot.public_price) {
                                            self.lot_selected = lot;
                                            setTimeout(function () {
                                                self.click_confirm();
                                            }, 500)
                                        }
                                    }
                                }
                            });
                        }
                    }
                },
                click_confirm: function () {
                    this._super();
                    if (this.lot_selected) {
                        var order = this.pos.get_order();
                        var selected_line = order.get_selected_orderline();
                        selected_line.set_unit_price(this.lot_selected['public_price']);
                        selected_line.price_manually_set = true;
                        selected_line.trigger('change', selected_line);
                        order.trigger('change', order);
                    }
                },
            })
        }
        if (popup.name == 'alert') {
            popup.widget.include({
                // TODO: we force core pos 2 option click
                // TODO 1: replace click .button.confirm become click .confirm
                // TODO 2: replace click .button.cancel  become click .cancel
                events: {
                    'click .cancel': 'click_cancel',
                    'click .confirm': 'click_confirm',
                    'click .selection-item': 'click_item',
                    'click .input-button': 'click_numpad',
                    'click .mode-button': 'click_numpad',
                },
            })
        }
    });

    PopupWidget.include({
        show: function(options) {
            this._super(options);
        },
        _check_is_duplicate: function (field_value, field_string) {
            var partners = this.pos.db.get_partners_sorted(-1);
            var old_partners = _.filter(partners, function (partner_check) {
                return partner_check[field_string] == field_value;
            });
            if (old_partners.length != 0) {
                return true;
            } else {
                return false;
            }
        },
        validate_date_field: function (value, $el) {
            if (value.match(/^\d{4}$/) !== null) {
                $el.val(value + '-');
            } else if (value.match(/^\d{4}\/\d{2}$/) !== null) {
                $el.val(value + '-');
            }
        },
        check_is_number: function (number) {
            var regex = /^[0-9]+$/;
            if (number.match(regex)) {
                return true
            } else {
                return false
            }
        },
        close: function () {
            this._super();
            var current_screen = this.pos.gui.get_current_screen();
            if (current_screen && current_screen == 'products') {
                this.pos.trigger('back:order'); // trigger again add keyboard
            }
        },
        wrong_input: function (element, message) {
            if (message) {
                this.$("span[class='card-issue']").text(message);
            }
            this.$(element).css({
                'box-shadow': '0px 0px 0px 2px rgb(236, 5, 5) inset',
                'border': 'none !important',
                'border-bottom': '0px !important'
            });
        },
        passed_input: function (element) {
            this.$(element).css({
                'box-shadow': '0px 0px 0px 1px rgb(34, 206, 3) inset',
            })
        }
    });

    var popup_select_tax = PopupWidget.extend({
        template: 'popup_select_tax',
        show: function (options) {
            var self = this;
            this.options = options;
            this.line_selected = options.line_selected;
            var product = this.line_selected.get_product();
            var taxes_ids = product.taxes_id;
            this._super(options);
            var taxes = options.taxes;
            this.taxes_selected = [];
            for (var i = 0; i < taxes.length; i++) {
                var tax = taxes[i];
                var tax_selected = _.find(taxes_ids, function (tax_id) {
                    return tax_id == tax['id'];
                })
                if (tax_selected) {
                    tax.selected = true;
                    this.taxes_selected.push(tax);
                } else {
                    tax.selected = false;
                }
            }
            self.$el.find('div.body').html(qweb.render('taxes_list', {
                taxes: taxes,
                widget: this
            }));
            this.$('.tax-item').click(function () {
                var tax_id = parseInt($(this).data('id'));
                var tax = self.pos.taxes_by_id[tax_id];
                if (tax) {
                    if ($(this).closest('.left_button').hasClass("item-selected") == true) {
                        $(this).closest('.left_button').toggleClass("item-selected");
                        self.taxes_selected = _.filter(self.taxes_selected, function (tax_selected) {
                            return tax_selected['id'] != tax['id']
                        })
                    } else {
                        $(this).closest('.left_button').toggleClass("item-selected");
                        self.taxes_selected.push(tax)
                    }
                }
            });
            this.$('.cancel').click(function () {
                self.gui.close_popup();
            });
            this.$('.add_taxes').click(function () {
                var line_selected = self.line_selected;
                if (self.taxes_selected.length == 0) {
                    return self.wrong_input("div[class='body']", '(*) Please select one tax');
                }
                var tax_ids = _.pluck(self.taxes_selected, 'id');
                line_selected.set_taxes(tax_ids);
                return self.pos.gui.close_popup();
            });
        }
    });
    gui.define_popup({name: 'popup_select_tax', widget: popup_select_tax});

    var popup_select_variants = PopupWidget.extend({
        template: 'popup_select_variants',
        get_attribute_by_id: function (attribute_id) {
            return this.pos.product_attribute_by_id[attribute_id];
        },
        show: function (options) {
            var self = this;
            this._super(options);
            this.variants_selected = {};
            var variants = options.variants;
            var selected_orderline = options.selected_orderline;
            var variants_selected = selected_orderline['variants'];
            if (!variants_selected) {
                variants_selected = [];
                selected_orderline.variants = [];
            }
            var variants_by_product_attribute_id = {};
            var attribute_ids = [];
            for (var i = 0; i < variants.length; i++) {
                var variant = variants[i];
                var attribute_id = variant['attribute_id'][0];
                var attribute = this.pos.product_attribute_by_id[attribute_id];
                if (attribute_ids.indexOf(attribute_id) == -1) {
                    attribute_ids.push(attribute_id)
                }
                if (attribute) {
                    if (!variants_by_product_attribute_id[attribute_id]) {
                        variants_by_product_attribute_id[attribute_id] = [variant];
                    } else {
                        variants_by_product_attribute_id[attribute_id].push(variant);
                    }
                }
            }
            if (variants_selected.length != 0) {
                for (var i = 0; i < variants.length; i++) {
                    var variant = _.findWhere(variants_selected, {id: variants[i].id});
                    if (variant) {
                        self.variants_selected[variant.id] = variant;
                        variants[i]['selected'] = true
                    } else {
                        variants[i]['selected'] = false
                    }
                }
            }
            var image_url = window.location.origin + '/web/image?model=product.template&field=image_medium&id=';
            self.$el.find('div.card-content').html(qweb.render('attribute_variant_list', {
                attribute_ids: attribute_ids,
                variants_by_product_attribute_id: variants_by_product_attribute_id,
                image_url: image_url,
                widget: self
            }));

            this.$('.line-select').click(function () {
                var variant_id = parseInt($(this).data('id'));
                var variant = self.pos.variant_by_id[variant_id];
                if (variant) {
                    if ($(this).closest('.line-select').hasClass("item-selected") == true) {
                        $(this).closest('.line-select').toggleClass("item-selected");
                        delete self.variants_selected[variant.id];
                    } else {
                        $(this).closest('.line-select').toggleClass("item-selected");
                        self.variants_selected[variant.id] = variant;

                    }
                }
            });
            this.$('.confirm').click(function () {
                var variant_ids = _.map(self.variants_selected, function (variant) {
                    return variant.id;
                });
                var order = self.pos.get_order();
                if (!order) {
                    return
                }
                var selected_line = order.get_selected_orderline();
                if (variants.length == 0) {
                    return self.wrong_input("div[class='body']", '(*) No variants select, please select one variant and back to confirm')
                }
                if (selected_line) {
                    selected_line.set_variants(variant_ids);
                }
                self.pos.gui.close_popup();
            });
            this.$('.cancel').click(function () {
                self.pos.gui.close_popup();
            });
            this.$('.remove_variants_selected').click(function () {
                var selected_orderline = self.pos.get_order().selected_orderline;
                if (!selected_orderline) {
                    return self.gui.show_popup('dialog', {
                        title: 'Warning !',
                        body: _t('Please select line'),
                    });
                } else {
                    selected_orderline['variants'] = [];
                    selected_orderline.set_unit_price(selected_orderline.product.list_price);
                    selected_orderline.price_manually_set = true;
                }
                self.pos.gui.close_popup();
                self.pos.gui.show_popup('dialog', {
                    title: 'Succeed',
                    body: _t('All variants removed'),
                    color: 'success'
                })
            })
        }
    });
    gui.define_popup({
        name: 'popup_select_variants',
        widget: popup_select_variants
    });
});
