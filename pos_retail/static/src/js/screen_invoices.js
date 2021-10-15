"use strict";
odoo.define('pos_retail.screen_invoices', function (require) {

    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var rpc = require('pos.rpc');
    var qweb = core.qweb;
    var gui = require('point_of_sale.gui');
    var PopupWidget = require('point_of_sale.popups');

    var popup_invoice_register_payment = PopupWidget.extend({
        template: 'popup_invoice_register_payment',
        show: function (options) {
            var self = this;
            options = options || {};
            options.cashregisters = this.pos.cashregisters;
            options.payment_methods = this.pos.payment_methods;
            options.title = options.invoice.number;
            options.invoice = options.invoice;
            this.options = options;
            this._super(options);

        },
        click_confirm: function () {
            var self = this;
            var fields = {};
            this.$('.field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            var invoice = this.options.invoice;
            if (!fields['residual'] || fields['residual'] <= 0) {
                return self.wrong_input('input[name="residual"]', "(*) Residual is required and bigger than 0");
            } else {
                self.passed_input('input[name="residual"]');
            }
            this.pos.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, this.options.invoice.id, parseInt(fields['journal_id']), parseFloat(fields['residual']));
            }
        }
    });
    gui.define_popup({name: 'popup_invoice_register_payment', widget: popup_invoice_register_payment});

    var button_go_invoice_screen = screens.ActionButtonWidget.extend({
        template: 'button_go_invoice_screen',
        button_click: function () {
            this.pos.gui.screen_instances["invoices"].refresh_screen();
            this.gui.show_screen('invoices');
        },
    });
    screens.define_action_button({
        'name': 'button_go_invoice_screen',
        'widget': button_go_invoice_screen,
        'condition': function () {
            return this.pos.config.management_invoice == true;
        }
    });

    var invoices_screen = screens.ScreenWidget.extend({
        template: 'invoices_screen',
        start: function () {
            var self = this;
            this._super();
            this.apply_sort_invoice();
            this.pos.bind('refresh:invoice_screen', function () {
                self.render_invoice_list(self.pos.db.get_invoices(1000));
                if (self.invoice_selected) {
                    var invoice = self.pos.db.invoice_by_id[self.invoice_selected['id']];
                    if (invoice) {
                        self.display_invoice_details(invoice)
                    } else {
                        self.hide_invoice_selected()
                    }
                }
            })
        },
        refresh_screen: function (reload_all) {
            var self = this;
            if (reload_all) {
                var invoice_model = this.pos.get_model('account.invoice');
                if (invoice_model) {
                    var first_load = this.pos.load_server_data_by_model(invoice_model);
                    return first_load.done(function () {
                        var invoice_line_model = self.pos.get_model('account.invoice.line');
                        var second_load = self.pos.load_server_data_by_model(invoice_line_model);
                        return second_load.done(function () {
                            self.pos.trigger('refresh:invoice_screen');
                        })
                    })
                }
            } else {
                this.pos.get_modifiers_backend_all_models().then(function () {
                    self.pos.trigger('refresh:invoice_screen');
                })
            }
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
            this.$('.invoice-list').delegate('.invoice-line', 'click', function (event) {
                self.invoice_select(event, $(this), parseInt($(this).data('id')));
            });
            this.$('.invoices_open').click(function () {
                var invoices = _.filter(self.pos.db.get_invoices(), function (invoice) {
                    return invoice.state == 'open';
                });
                if (invoices) {
                    var contents = self.$('.invoice-details-contents');
                    contents.empty();
                    return self.render_invoice_list(invoices);
                } else {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Your database have not any invoices state at Open'
                    })
                }
            });
            this.$('.button_sync').click(function () {
                self.refresh_screen();
            });
            this.el.querySelector('.searchbox input').addEventListener('keypress', this.search_handler);
            this.el.querySelector('.searchbox input').addEventListener('keydown', this.search_handler);
            this.el.querySelector('.searchbox .search-clear').addEventListener('click', this.clear_search_handler);

        },
        show: function () {
            this.render_screen();
            this._super();
            this.$el.find('input').focus();
            this.refresh_screen();
            if (this.invoice_selected) {
                this.display_invoice_details(this.invoice_selected);
            }
        },
        apply_sort_invoice: function () {
            var self = this;
            this.$('.sort_by_invoice_id').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('id', self.reverse, parseInt));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_create_date').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('create_date', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_number').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('number', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_origin').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('origin', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_partner_name').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('partner_name', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_payment_term_id').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('payment_term', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_date_invoice').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('date_invoice', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_date_due').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('date_due', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_user_id').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('user', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_amount_tax').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('amount_tax', self.reverse, parseInt));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_amount_total').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('amount_total', self.reverse, parseInt));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_residual').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('residual', self.reverse, parseInt));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_state').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('state', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
        },
        invoice_select: function (event, $invoice, id) {
            var invoice = this.pos.db.get_invoice_by_id(id);
            this.$('.invoice-line').removeClass('highlight');
            $invoice.addClass('highlight');
            this.display_invoice_details(invoice);
        },
        display_invoice_details: function (invoice) {
            var self = this;
            this.invoice_selected = invoice;
            setTimeout(function () {
                self.$('.searchbox input')[0].value = '';
                self.$('.searchbox input').focus();
            }, 1000);
            var contents = this.$('.invoice-details-contents');
            contents.empty();
            var $row_selected = this.$("[data-id='" + invoice['id'] + "']");
            $row_selected.addClass('highlight');
            invoice.link = window.location.origin + "/web#id=" + invoice.id + "&view_type=form&model=account.invoice";
            contents.append($(qweb.render('invoice_detail', {widget: this, invoice: invoice})));
            var account_invoice_lines = this.pos.db.lines_invoice_by_id[invoice['id']];
            if (account_invoice_lines) {
                var line_contents = this.$('.invoice_lines_detail');
                line_contents.empty();
                line_contents.append($(qweb.render('account_invoice_lines', {
                    widget: this,
                    account_invoice_lines: account_invoice_lines
                })));
            }
            this.$('.inv-print-invoice').click(function () { // print invoice
                self.chrome.do_action('account.account_invoices', {
                    additional_context: {
                        active_ids: [self.invoice_selected['id']]
                    }
                })
            });
            this.$('.inv-print-invoice-without-payment').click(function () { // print invoice without payment
                self.chrome.do_action('account.account_invoices_without_payment', {
                    additional_context: {
                        active_ids: [self.invoice_selected['id']]
                    }
                })
            });
            this.$('.inv-send-email').click(function () { // send email invoice to customer

            });

            this.$('.inv-register-payment').click(function () { // register payment invoice
                self.gui.show_popup('popup_invoice_register_payment', {
                    invoice: self.invoice_selected,
                    confirm: function (invoice_id, journal_id, amount) {
                        self.pay_amount = amount;
                        return rpc.query({
                            model: 'account.invoice',
                            method: 'pos_register_amount',
                            args:
                                [invoice_id, journal_id, amount]
                        }).then(function (status) {
                            self.refresh_screen(true);
                            if (status == false) {
                                return self.gui.show_popup('dialog', {
                                    title: 'Warning',
                                    body: invoice.number + ' is paid, could not register more'
                                });
                            } else {
                                return self.gui.show_popup('dialog', {
                                    title: 'Done',
                                    body: invoice.number + ' registered amount ' + self.pay_amount,
                                    color: 'success'
                                });
                            }
                        }).fail(function (error) {
                            return self.pos.query_backend_fail(error);
                        });
                    }
                })
            });
            this.$('.inv-action_invoice_open').click(function () { // action inv open
                return rpc.query({
                    model: 'account.invoice',
                    method: 'action_invoice_open',
                    args: [self.invoice_selected['id']]
                }).then(function () {
                    self.link = window.location.origin + '/web#id=' + self.invoice_selected['id'] + '&view_type=form&model=account.invoice';
                    self.refresh_screen();
                    return self.gui.show_popup('confirm', {
                        title: 'Done',
                        body: 'Click open new tab review invoice',
                        confirm: function () {
                            window.open(self.link, '_blank');
                        }
                    });
                }).fail(function (error) {
                    self.pos.query_backend_fail(error)
                });

            });
            this.$('.inv-add-credit-note').click(function () {
                self.gui.show_popup('popup_account_invoice_refund', {
                    invoice: self.invoice_selected,
                    confirm: function (invoice_id, params) {
                        self.filter_refund = params['filter_refund'];
                        rpc.query({
                            model: 'account.invoice.refund',
                            method: 'create',
                            args: [params],
                            context: {
                                active_ids: [invoice_id]
                            }
                        }).then(function (refund_id) {
                            rpc.query({
                                model: 'account.invoice.refund',
                                method: 'compute_refund',
                                args: [refund_id, self.filter_refund],
                                context: {
                                    active_ids: [self.invoice_selected['id']],
                                    // move_name: self.invoice_selected['number'],
                                }
                            }).then(function (result) {
                                var refund_invoice = rpc.query({
                                    model: 'account.invoice',
                                    method: 'search_read',
                                    args: [[['refund_invoice_id', '=', self.invoice_selected['id']]]],
                                });
                                refund_invoice.then(function (refund_invoices) {
                                    if (refund_invoices.length) {
                                        for (var i = 0; i < refund_invoices.length; i++) {
                                            var refund_invoice = refund_invoices[i];
                                            var value_update = {
                                                // 'number': self.invoice_selected['number'] + '(credit note)',
                                            }
                                            self.refund_invoice = refund_invoice
                                            rpc.query({ // update invoice
                                                model: 'account.invoice',
                                                method: 'write',
                                                args: [[self.refund_invoice['id']], value_update],
                                            }).then(function () {
                                                var open_inv = rpc.query({ // open invoice
                                                    model: 'account.invoice',
                                                    method: 'action_invoice_open',
                                                    args: [self.refund_invoice['id']],
                                                });
                                                open_inv.then(function () {
                                                    self.link = window.location.origin + "/web#id=" + self.refund_invoice['id'] + "&view_type=form&model=account.invoice";
                                                    self.refresh_screen();
                                                    self.pos.gui.show_popup('confirm', {
                                                        title: 'Done',
                                                        body: 'Are you want open invoice review ?',
                                                        confirm: function () {
                                                            window.open(self.link, '_blank');
                                                        }
                                                    })
                                                }).fail(function (error) {
                                                    return self.pos.query_backend_fail(error);
                                                });
                                            });

                                        }
                                    } else {
                                        self.pos.gui.show_popup('dialog', {
                                            title: 'Error',
                                            body: 'Refund fail, could not find any invoice'
                                        })
                                    }
                                })
                            }).fail(function (error) {
                                return self.pos.query_backend_fail(error);
                            });
                        }).fail(function (error) {
                            return self.pos.query_backend_fail(error);
                        });
                    }
                })
            });
        },
        hide_invoice_selected: function () { // hide when re-print receipt
            var contents = this.$('.invoice-details-contents');
            contents.empty();
            this.invoice_selected = null;

        },
        render_screen: function () {
            this.pos.invoice_selected = null;
            var self = this;
            if (this.pos.db.get_invoices().length) {
                this.render_invoice_list(this.pos.db.get_invoices(1000));
            }
            this.$('.back').click(function () {
                self.clear_search();
                self.gui.show_screen('products');
            });
        },
        perform_search: function (query, associate_result) {
            if (query) {
                var invoices = this.pos.db.search_invoice(query);
                this.render_invoice_list(invoices);
            } else {
                var invoices = this.pos.db.get_invoices(1000);
                this.render_invoice_list(invoices);
            }
        },
        clear_search: function () {
            var contents = this.$('.invoice-details-contents');
            contents.empty();
            var invoices = this.pos.db.get_invoices(1000);
            this.render_invoice_list(invoices);
            this.hide_invoice_selected();
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        partner_icon_url: function (id) {
            return '/web/image?model=res.partner&id=' + id + '&field=image_small';
        },
        render_invoice_list: function (invoices) {
            var contents = this.$el[0].querySelector('.invoice-list');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(invoices.length, 1000); i < len; i++) {
                var invoice = invoices[i];
                var invoice_html = qweb.render('invoice_row', {
                    widget: this,
                    invoice: invoice
                });
                invoice = document.createElement('tbody');
                invoice.innerHTML = invoice_html;
                invoice = invoice.childNodes[1];
                contents.appendChild(invoice);
            }
        }
    });
    gui.define_screen({name: 'invoices', widget: invoices_screen});

});
