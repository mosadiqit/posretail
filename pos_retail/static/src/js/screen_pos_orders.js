"use strict";
odoo.define('pos_retail.screen_pos_orders', function (require) {

    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var rpc = require('pos.rpc');
    var qweb = core.qweb;
    var PopupWidget = require('point_of_sale.popups');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;

    var popup_register_payment = PopupWidget.extend({
        template: 'popup_register_payment',
        show: function (options) {
            var self = this;
            options = options || {};
            options.cashregisters = this.pos.cashregisters;
            options.amount_debit = round_pr(options.pos_order.amount_total - options.pos_order.amount_paid, this.pos.currency.rounding);
            options.order = options.pos_order;
            this.options = options;
            if (options.amount_debit <= 0) {
                return this.gui.show_popup('dialog', {
                    title: _t('Warning'),
                    body: 'Order have paid full',
                });
            } else {
                this._super(options);
                this.$el.find('.datepicker').datetimepicker({
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
                this.$el.find('.payment-full').click(function () {
                    self.payment_full();
                });
                this.$el.find('.confirm').click(function () {
                    self.click_confirm();
                });
                this.$el.find('.cancel').click(function () {
                    self.pos.gui.close_popup();
                });
            }
        },
        put_money_in: function () {
            var self = this;
            this.pos.gui.show_popup('popup_money_control', {
                title: 'Put Money In',
                body: 'Describe why you take money from the cash register',
                reason: this.payment_reference,
                amount: this.amount,
                confirm: function (reason, amount) {
                    var values = {
                        reason: reason,
                        amount: amount,
                        session_id: self.pos.pos_session.id
                    };
                    self.reason = reason;
                    self.amount = amount;
                    return rpc.query({
                        model: 'cash.box.in',
                        method: 'cash_input_from_pos',
                        args: [0, values],
                    }, {shadow: true, timeout: 30000}).then(function (result) {
                        self.pos.gui.screen_instances['pos_orders_screen'].refresh_screen();
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Succeed',
                            body: 'You just put ' + self.pos.gui.chrome.format_currency(self.amount) + ' to cash box',
                            color: 'succedd'
                        })
                    }).fail(function (error) {
                        return self.pos.query_backend_fail(error)
                    });
                },
                cancel: function () {
                    self.pos.gui.screen_instances['pos_orders_screen'].refresh_screen();
                    self.pos.gui.close_popup()
                }
            });
        },
        click_confirm: function () {
            var self = this;
            var fields = {};
            this.$('.field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            fields['amount'] = parseFloat(fields['amount']);
            fields['journal_id'] = parseInt(fields['journal_id']);
            if (!fields['payment_reference']) {
                return this.wrong_input("input[name='payment_reference']", '(*) Please input payment reference');
            } else {
                this.passed_input("input[name='payment_reference']")
            }
            if (!fields['payment_date']) {
                return this.wrong_input("input[name='payment_date']", '(*) Please input payment date');
            } else {
                this.passed_input("input[name='payment_date']")
            }
            if (!fields['amount'] || fields['amount'] <= 0) {
                return this.wrong_input("input[name='amount']", '(*) Amount required bigger than 0');
            } else {
                this.passed_input("input[name='amount']")
            }
            if (!fields['journal_id']) {
                return this.wrong_input("input[name='journal_id']", '(*) Payment Mode is required');
            }

            var amount = parseFloat(fields['amount']);
            this.amount = amount;
            var journal_id = fields['journal_id'];
            var payment_reference = fields['payment_reference'];
            this.payment_reference = payment_reference;
            var params = {
                session_id: this.pos.pos_session.id,
                journal_id: journal_id,
                amount: fields['amount'],
                payment_name: payment_reference,
                payment_date: fields['payment_date']
            };
            var balance = round_pr(this.options.pos_order['amount_total'] - this.options.pos_order['amount_paid'], this.pos.currency.rounding);
            if (amount > balance) {
                return this.wrong_input("input[name='amount']", '(*) You can not register amount bigger than debit amount order')
            }
            self.pos.gui.close_popup();
            return rpc.query({
                model: 'pos.make.payment',
                method: 'create',
                args:
                    [params],
                context: {
                    active_id: this.options.pos_order['id']
                }
            }).done(function (payment_id) {
                return rpc.query({
                    model: 'pos.make.payment',
                    method: 'check',
                    args: [payment_id],
                    context: {
                        active_id: self.options.pos_order['id']
                    }
                }, {shadow: true, timeout: 30000}).then(function () {
                    self.put_money_in();
                })
            }).fail(function (error) {
                return self.pos.query_backend_fail(error);
            });
        },
        payment_full: function () {
            var self = this;
            var fields = {};
            this.$('.field').each(function (idx, el) {
                fields[el.name] = el.value || ''
            });
            fields['amount'] = parseFloat(fields['amount']);
            fields['journal_id'] = parseInt(fields['journal_id']);
            if (!fields['payment_reference']) {
                return this.wrong_input("input[name='payment_reference']", '(*) Please input payment reference');
            } else {
                this.passed_input("input[name='payment_reference']")
            }
            if (!fields['payment_date']) {
                return this.wrong_input("input[name='payment_date']", '(*) Please input payment date');
            } else {
                this.passed_input("input[name='payment_date']")
            }
            if (!fields['amount'] || fields['amount'] <= 0) {
                return this.wrong_input("input[name='amount']", '(*) Amount required bigger than 0');
            } else {
                this.passed_input("input[name='amount']")
            }
            if (!fields['journal_id']) {
                return this.wrong_input("input[name='journal_id']", '(*) Payment Mode is required');
            }
            this.amount = parseFloat(fields['amount']);
            var payment_reference = fields['payment_reference'];
            this.payment_reference = payment_reference;
            var params = {
                session_id: this.pos.pos_session.id,
                journal_id: fields['journal_id'],
                amount: this.options.pos_order.amount_total - this.options.pos_order.amount_paid,
                payment_name: payment_reference,
                payment_date: fields['payment_date']
            };
            this.pos.gui.close_popup();
            return rpc.query({
                model: 'pos.make.payment',
                method: 'create',
                args:
                    [params],
                context: {
                    active_id: this.options.pos_order['id']
                }
            }).then(function (payment_id) {
                return rpc.query({
                    model: 'pos.make.payment',
                    method: 'check',
                    args: [payment_id],
                    context: {
                        active_id: self.options.pos_order['id']
                    }
                }, {shadow: true, timeout: 30000}).then(function () {
                    self.put_money_in();
                })
            }).fail(function (error) {
                return self.pos.query_backend_fail(error);
            });
        }
    });
    gui.define_popup({name: 'popup_register_payment', widget: popup_register_payment});

    var button_go_pos_orders_screen = screens.ActionButtonWidget.extend({ // pos orders management
        template: 'button_go_pos_orders_screen',
        button_click: function () {
            this.pos.gui.screen_instances["pos_orders_screen"].refresh_screen();
            this.gui.show_screen('pos_orders_screen');
        }
    });
    screens.define_action_button({
        'name': 'button_go_pos_orders_screen',
        'widget': button_go_pos_orders_screen,
        'condition': function () {
            return this.pos.config.pos_orders_management == true;
        }
    });

    var popup_return_pos_order_lines = PopupWidget.extend({
        template: 'popup_return_pos_order_lines',
        show: function (options) {
            var self = this;
            this.line_selected = [];
            var order_lines = options.order_lines;
            for (var i = 0; i < order_lines.length; i++) {
                var line = order_lines[i];
                var product_id = line.product_id[0];
                var product = this.pos.db.get_product_by_id(product_id);
                if (product) {
                    line['name'] = this.pos.generate_wrapped_name(product.display_name)[0];
                    this.line_selected.push(line);
                }
            }
            this.order = options.order;
            this._super(options);
            this.options = options;
            var image_url = window.location.origin + '/web/image?model=product.product&field=image_medium&id=';
            if (order_lines) {
                self.$el.find('tbody').html(qweb.render('return_pos_order_line', {
                    order_lines: order_lines,
                    image_url: image_url,
                    widget: self
                }));
                this.$('.line-select').click(function () {
                    var line_id = parseInt($(this).data('id'));
                    var line = self.pos.db.order_line_by_id[line_id];
                    var checked = this.checked;
                    if (checked == false) {
                        for (var i = 0; i < self.line_selected.length; ++i) {
                            if (self.line_selected[i].id == line.id) {
                                self.line_selected.splice(i, 1);
                            }
                        }
                    } else {
                        self.line_selected.push(line);
                    }
                });
                this.$('.confirm_return_order').click(function () {
                    if (self.line_selected == [] || !self.order || self.line_selected.length == 0) {
                        return self.wrong_input("div[class='table-responsive']", "(*) Please select minimum 1 line for return")
                    } else {
                        self.pos.add_return_order(self.order, self.line_selected);
                        return self.pos.gui.show_screen('payment');
                    }
                });
                this.$('.create_voucher').click(function () { // create voucher when return order
                    if (self.line_selected == [] || !self.order || self.line_selected.length == 0) {
                        return self.wrong_input("div[class='table-responsive']", "(*) Please select minimum 1 line for return")
                    } else {
                        return self.gui.show_popup('popup_manual_create_voucher', {
                            title: 'Voucher Card',
                            order: self.order,
                            line_selected: self.line_selected
                        })

                    }

                });
                this.$('.cancel').click(function () {
                    self.pos.gui.close_popup();
                });
                this.$('.qty_minus').click(function () {
                    var line_id = parseInt($(this).data('id'));
                    var line = self.pos.db.order_line_by_id[line_id];
                    var quantity = parseFloat($(this).parent().find('.qty').text());
                    if (quantity > 1) {
                        var new_quantity = quantity - 1;
                        $(this).parent().find('.qty').text(new_quantity);
                        line['new_quantity'] = new_quantity;
                    }
                });
                this.$('.qty_plus').click(function () {
                    var line_id = parseInt($(this).data('id'));
                    var line = self.pos.db.order_line_by_id[line_id];
                    var quantity = parseFloat($(this).parent().find('.qty').text());
                    if (line['qty'] >= (quantity + 1)) {
                        var new_quantity = quantity + 1;
                        $(this).parent().find('.qty').text(new_quantity);
                        line['new_quantity'] = new_quantity;
                    }
                })
            }
        }
    });
    gui.define_popup({
        name: 'popup_return_pos_order_lines',
        widget: popup_return_pos_order_lines
    });

    var pos_orders_screen = screens.ScreenWidget.extend({
        template: 'pos_orders_screen',
        init: function (parent, options) {
            var self = this;
            this.reverse = true;
            this._super(parent, options);
            this.pos.bind('refresh:pos_orders_screen', function () {
                self.render_pos_order_list(self.pos.db.get_pos_orders(1000));
                self.hide_order_selected();
            }, this);
        },
        show: function () {
            var self = this;
            this._super();
            if (this.order_selected) {
                this.display_pos_order_detail(this.order_selected);
            }
        },
        refresh_screen: function () {
            var self = this;
            this.pos.get_modifiers_backend_all_models().then(function () {
                self.pos.trigger('refresh:pos_orders_screen');
            })
        },
        renderElement: function () {
            var self = this;
            this.search_handler = function (event) {
                if (event.type == "keypress" || event.keyCode === 46 || event.keyCode === 8) {
                    var searchbox = this;
                    setTimeout(function () {
                        self.perform_search(searchbox.value, event.which === 13);
                    }, 70);
                }
            };
            this._super();
            this.clear_search_handler = function (event) {
                self.clear_search();
            };
            this.$el.find('input').focus();
            this.$('.back').click(function () {
                self.gui.show_screen('products');
            });
            this.$('.only_partial_payment_orders').click(function () {
                var orders = _.filter(self._get_orders(), function (order) {
                    return order.state == 'partial_payment';
                });
                if (orders) {
                    return self.render_pos_order_list(orders);
                } else {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Have not any partial payment orders'
                    })
                }
            });
            this.$('.button_sync').click(function () {
                self.refresh_screen()
            });
            var input = this.el.querySelector('.searchbox input');
            input.value = '';
            input.focus();
            this.render_pos_order_list(this.pos.db.get_pos_orders(1000));
            this.$('.client-list-contents').delegate('.pos_order_row', 'click', function (event) {
                self.order_select(event, $(this), parseInt($(this).data('id')));
            });
            this.el.querySelector('.searchbox input').addEventListener('keypress', this.search_handler);
            this.el.querySelector('.searchbox input').addEventListener('keydown', this.search_handler);
            this.el.querySelector('.searchbox .search-clear').addEventListener('click', this.clear_search_handler);
            this.$('.searchbox .search-clear').click(function () {
                self.clear_search();
            });
            this.sort_orders();
        },
        sort_orders: function () {
            var self = this;
            this.$('.sort_by_order_date').click(function () {
                var orders = self._get_orders().sort(self.pos.sort_by('date_order', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_pos_order_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_pos_order_id').click(function () {
                var orders = self._get_orders().sort(self.pos.sort_by('id', self.reverse, parseInt));
                self.render_pos_order_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_pos_order_amount_total').click(function () {
                var orders = self._get_orders().sort(self.pos.sort_by('amount_total', self.reverse, parseInt));
                self.render_pos_order_list(orders);
                self.reverse = !self.reverse;

            });
            this.$('.sort_by_pos_order_amount_paid').click(function () {
                var orders = self._get_orders().sort(self.pos.sort_by('amount_paid', self.reverse, parseInt));
                self.render_pos_order_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_pos_order_amount_tax').click(function () {
                var orders = self._get_orders().sort(self.pos.sort_by('amount_tax', self.reverse, parseInt));
                self.render_pos_order_list(orders);
                self.reverse = !self.reverse;

            });
            this.$('.sort_by_pos_order_name').click(function () {
                var orders = self._get_orders().sort(self.pos.sort_by('name', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_pos_order_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_pos_reference').click(function () {
                var orders = self._get_orders().sort(self.pos.sort_by('pos_reference', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_pos_order_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_pos_order_partner_name').click(function () {
                var orders = self._get_orders().sort(self.pos.sort_by('partner_name', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_pos_order_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_pos_order_barcode').click(function () {
                var orders = self._get_orders().sort(self.pos.sort_by('ean13', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase();
                }));
                self.render_pos_order_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_pos_order_sale_person').click(function () {
                var orders = self._get_orders().sort(self.pos.sort_by('sale_person', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase();
                }));
                self.render_pos_order_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_pos_order_state').click(function () {
                var orders = self._get_orders().sort(self.pos.sort_by('state', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase();
                }));
                self.render_pos_order_list(orders);
                self.reverse = !self.reverse;
            });
        },
        clear_search: function () {
            this.render_pos_order_list(this.pos.db.get_pos_orders());
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
            this.display_pos_order_detail(null);
        },
        perform_search: function (query, associate_result) {
            var orders;
            if (query) {
                orders = this.pos.db.search_order(query);
                if (associate_result && orders.length === 1) {
                    return this.display_pos_order_detail(orders[0]);
                }
                return this.render_pos_order_list(orders);

            } else {
                orders = this.pos.db.get_pos_orders();
                return this.render_pos_order_list(orders);
            }
        },
        partner_icon_url: function (id) {
            return '/web/image?model=res.partner&id=' + id + '&field=image_small';
        },
        order_select: function (event, $order, id) {
            var order = this.pos.db.order_by_id[id];
            this.$('.client-line').removeClass('highlight');
            $order.addClass('highlight');
            this.display_pos_order_detail(order);
        },
        _get_orders: function () {
            if (!this.orders_list) {
                return this.pos.db.get_pos_orders()
            } else {
                return this.orders_list
            }
        },
        render_pos_order_list: function (orders) {
            var contents = this.$el[0].querySelector('.pos_order_list');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                var order = orders[i];
                var pos_order_row_html = qweb.render('pos_order_row', {widget: this, order: order});
                var pos_order_row = document.createElement('tbody');
                pos_order_row.innerHTML = pos_order_row_html;
                pos_order_row = pos_order_row.childNodes[1];
                if (order === this.order_selected) {
                    pos_order_row.classList.add('highlight');
                } else {
                    pos_order_row.classList.remove('highlight');
                }
                contents.appendChild(pos_order_row);
            }
            this.orders_list = orders;
        },
        hide_order_selected: function () { // hide when re-print receipt
            var contents = this.$('.pos_detail');
            contents.empty();
            this.order_selected = null;

        },
        display_pos_order_detail: function (order) {
            var contents = this.$('.pos_detail');
            contents.empty();
            var self = this;
            this.order_selected = order;
            if (!order) {
                return;
            }
            var $row_selected = this.$("[data-id='" + order['id'] + "']");
            $row_selected.addClass('highlight');
            order['link'] = window.location.origin + "/web#id=" + order.id + "&view_type=form&model=pos.order";
            contents.append($(qweb.render('pos_order_detail', {widget: this, order: order})));
            var lines = this.pos.db.lines_by_order_id[order['id']];
            if (lines) {
                var line_contents = this.$('.lines_detail');
                line_contents.empty();
                line_contents.append($(qweb.render('pos_order_lines', {widget: this, lines: lines})));
            }
            ;
            this.$('.return_order').click(function () {
                var order = self.order_selected;
                var order_lines = self.pos.db.lines_by_order_id[order['id']];
                if (!order_lines) {
                    return self.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Order empty lines',
                    });
                } else {
                    return self.gui.show_popup('popup_return_pos_order_lines', {
                        order_lines: order_lines,
                        order: order
                    });
                }
            });
            this.$('.register_amount').click(function () {
                var pos_order = self.order_selected;
                if (pos_order) {
                    self.gui.show_popup('popup_register_payment', {
                        pos_order: pos_order
                    })
                }
            });
            this.$('.create_invoice').click(function () {
                var pos_order = self.order_selected;
                if (pos_order) {
                    return self.gui.show_popup('confirm', {
                        title: 'Create invoice ?',
                        body: 'Are you want create invoice for ' + pos_order['name'] + ' ?',
                        confirm: function () {
                            self.pos.gui.close_popup();
                            return rpc.query({
                                model: 'pos.order',
                                method: 'made_invoice',
                                args:
                                    [[pos_order['id']]],
                                context: {
                                    pos: true
                                }
                            }).then(function (invoice_vals) {
                                self.link = window.location.origin + "/web#id=" + invoice_vals[0]['id'] + "&view_type=form&model=account.invoice";
                                return self.gui.show_popup('confirm', {
                                    title: 'Are you want open invoice?',
                                    body: 'Invoice created',
                                    confirmButtonText: 'Yes',
                                    cancelButtonText: 'Close',
                                    confirm: function () {
                                        window.open(self.link, '_blank');
                                    },
                                    cancel: function () {
                                        self.pos.gui.close_popup();
                                    }
                                });
                            }).fail(function (error) {
                                return self.pos.query_backend_fail(error);
                            });
                        },
                        cancel: function () {
                            return self.pos.gui.close_popup();
                        }
                    });
                }
            });
            this.$('.reprint_order').click(function () {
                var order = self.order_selected;
                if (!order) {
                    return;
                }
                var lines = self.pos.db.lines_by_order_id[order['id']];
                if (!lines || !lines.length) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'WARNING',
                        body: 'Order blank lines',
                    });
                } else {
                    var new_order = new models.Order({}, {pos: self.pos, temporary: true});
                    new_order['pos_reference'] = order['pos_reference'];
                    new_order['create_date'] = order['create_date'];
                    new_order['ean13'] = order['ean13'];
                    new_order['name'] = order['name'];
                    new_order['date_order'] = order['date_order'];
                    var partner = order['partner_id'];
                    if (partner) {
                        var partner_id = partner[0];
                        var partner = self.pos.db.get_partner_by_id(partner_id);
                        new_order.set_client(partner);
                    }
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i];
                        var product = self.pos.db.get_product_by_id(line.product_id[0]);
                        if (!product) {
                            continue
                        } else {
                            var new_line = new models.Orderline({}, {
                                pos: self.pos,
                                order: new_order,
                                product: product
                            });
                            new_line.set_quantity(line.qty, 'keep price, for re-print receipt');
                            new_order.orderlines.add(new_line);
                            if (line.discount) {
                                new_line.set_discount(line.discount);
                            }
                            if (line.discount_reason) {
                                new_line.discount_reason = line.discount_reason;
                            }
                            if (line.promotion) {
                                new_line.promotion = line.promotion;
                            }
                            if (line.promotion_reason) {
                                new_line.promotion_reason = line.promotion_reason;
                            }
                            if (line.note) {
                                new_line.set_line_note(line.note);
                            }
                            if (line.plus_point) {
                                new_line.plus_point = line.plus_point;
                            }
                            if (line.redeem_point) {
                                new_line.redeem_point = line.redeem_point;
                            }
                            if (line.uom_id) {
                                var uom_id = line.uom_id[0];
                                var uom = self.pos.uom_by_id[uom_id];
                                if (uom) {
                                    new_line.set_unit(uom_id);
                                }
                            }
                            if (line.notice) {
                                new_line.notice = line.notice;
                            }
                            new_line.set_unit_price(line.price_unit);
                        }
                    }
                    var orders = self.pos.get('orders');
                    orders.add(new_order);
                    self.pos.set('selectedOrder', new_order);
                    self.pos.gui.show_screen('receipt');

                }
            });
            this.$('.action_pos_order_cancel').click(function () {
                var order = self.order_selected;
                self.pos.gui.show_popup('confirm', {
                    title: 'Warning',
                    body: 'Are you sure cancel order ' + order['name'] + ' ?',
                    confirm: function () {
                        return rpc.query({
                            model: 'pos.order',
                            method: 'action_pos_order_cancel',
                            args:
                                [[self.order_selected['id']]],
                            context: {
                                pos: true
                            }
                        }).then(function () {
                            self.display_pos_order_detail(null);
                            self.pos.gui.show_popup('dialog', {
                                title: 'Done',
                                body: 'Order just processed to cancel'
                            });
                            var orders = _.filter(self.pos.db.get_pos_orders(), function (order) {
                                return order['state'] != 'paid' && order['state'] != 'done' && order['state'] != 'invoiced' && order['state'] != 'cancel'
                            });
                            self.render_pos_order_list(orders);
                            return self.pos.gui.close_popup();
                        }).fail(function (error) {
                            return self.pos.query_backend_fail(error);
                        })
                    },
                    cancel: function () {
                        return self.pos.gui.close_popup();
                    }
                })
            })
        }
    });
    gui.define_screen({name: 'pos_orders_screen', widget: pos_orders_screen});
});
