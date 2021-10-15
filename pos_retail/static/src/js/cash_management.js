"use strict";
odoo.define('pos_retail.cash_management', function (require) {
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var rpc = require('pos.rpc');
    var PopupWidget = require('point_of_sale.popups');

    var button_cash_management = screens.ActionButtonWidget.extend({
        template: 'button_cash_management',
        init: function (parent, options) {
            this._super(parent, options);
        },
        button_click: function () {
            var self = this;
            var calling = new $.Deferred();
            rpc.query({
                model: 'pos.session',
                method: 'search_read',
                args: [[['id', '=', this.pos.pos_session.id]]]
            }).then(function (sessions) {
                calling.resolve();
                if (sessions) {
                    self.pos.gui.show_popup('popup_session', {
                        session: sessions[0]
                    })
                } else {
                    self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Have something wrong, could not find your session'
                    })
                }
            }, function (err) {
                calling.reject(err);
                self.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Your session offline mode, could not calling odoo server'
                })
            });
            return calling;
        }
    });
    screens.define_action_button({
        'name': 'button_cash_management',
        'widget': button_cash_management,
        'condition': function () {
            return this.pos.config.management_session && this.pos.config.default_cashbox_lines_ids && this.pos.config.cash_control;
        }
    });

    var popup_balance = PopupWidget.extend({
        template: 'popup_balance',
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .cashbox-add': 'onclick_cashboxadd',
            'click .cashbox-delete': 'onclick_cashboxdelete',
            'blur .cashbox-edit': 'onchange_text'
        }),

        onclick_cashboxadd: function (e) {
            var self = this;
            var table = document.getElementById('cashbox-grid');
            var rowCount = table.getElementsByTagName("tbody")[0].getElementsByTagName("tr").length;

            var newRow = table.insertRow(rowCount);
            var row = rowCount - 1;
            newRow.id = row;

            var col1html = "";
            var col2html = "<input id='cashbox_" + row + "_coin_value' value='0' name='coin_value' class='cashbox-edit'/>";
            var col3html = "<input id='cashbox_" + row + "_number' value='0' name='number' class='cashbox-edit' onkeypress='return (event.charCode &gt;= 48 &amp;&amp; event.charCode &lt;= 57) || (event.charCode == 0 || event.charCode == 08 || event.charCode == 127)'/>";
            var col4html = "";
            var col5html = "<span class='cashbox-delete fa fa-trash-o' name='delete'/>";

            var col1 = newRow.insertCell(0);
            col1.style = "display:none";
            col1.innerHTML = col1html;
            var col2 = newRow.insertCell(1);
            col2.innerHTML = col2html;
            var col3 = newRow.insertCell(2);
            col3.innerHTML = col3html;
            var col4 = newRow.insertCell(3);
            col4.id = "cashbox_" + row + "_subtotal";
            col4.innerHTML = col4html;
            var col5 = newRow.insertCell(4);
            if (self.options.pos_cashbox_line[0]['is_delete']) {
                col5.innerHTML = col5html;
            }
        },
        onclick_cashboxdelete: function (e) {
            var tr = $(e.currentTarget).closest('tr');
            var record_id = tr.find('td:first-child').text();
            if (parseInt(record_id))
                tr.find("td:not(:first)").remove();
            else
                tr.find("td").remove();
            tr.hide();
            var tr_id = tr.attr('id');
            var tbl = document.getElementById("cashbox-grid");
            var row = tbl.getElementsByTagName("tbody")[0].getElementsByTagName("tr");
            var total = 0;
            for (var i = 0; i < row.length - 1; i++) {
                var cell_count = row[i].cells.length;
                if (cell_count > 1) {
                    var subtotal = document.getElementById("cashbox_" + i + "_subtotal").innerHTML;
                    if (subtotal)
                        total += parseFloat(subtotal);
                }
            }
            document.getElementById("cashbox_total").innerHTML = total;
            rpc.query({
                model: 'account.bank.statement.cashbox',
                method: 'remove_cashbox_line',
                args: [0, parseInt(record_id)],
            });
        },
        onchange_text: function (e) {
            var tr = $(e.currentTarget).closest('tr');
            var tr_id = tr.attr('id');
            var number = document.getElementById("cashbox_" + tr_id + "_number").value;
            var coin_value = document.getElementById("cashbox_" + tr_id + "_coin_value").value;
            document.getElementById("cashbox_" + tr_id + "_subtotal").innerHTML = number * coin_value;
            var tbl = document.getElementById("cashbox-grid");
            var row = tbl.getElementsByTagName("tbody")[0].getElementsByTagName("tr");
            var total = 0;
            for (var i = 0; i < row.length - 1; i++) {
                var cell_count = row[i].cells.length;
                if (cell_count > 1) {
                    var subtotal = document.getElementById("cashbox_" + i + "_subtotal").innerHTML;
                    if (subtotal)
                        total += parseFloat(subtotal);
                }
            }
            document.getElementById("cashbox_total").innerHTML = total;
        }
    });
    gui.define_popup({name: 'popup_balance', widget: popup_balance});

    var popup_money_control = PopupWidget.extend({
        template: 'popup_money_control',
        show: function (options) {
            var self = this;
            this.options = options;
            this._super(options);
        },
        click_confirm: function () {
            var fields = {};
            this.$('.field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields['reason']) {
                return this.wrong_input('input[name="reason"]', '(*) Reason is required');
            } else {
                this.passed_input('input[name="reason"]')
            }
            if (!fields['amount']) {
                return this.wrong_input('input[name="amount"]', '(*) Amount is required');
            } else {
                this.passed_input('input[name="amount"]');
            }
            if (fields['amount'] <= 0) {
                return this.wrong_input('input[name="amount"]', '(*) Amount could not smaller than 0');
            } else {
                this.passed_input('input[name="amount"]')
            }
            this.pos.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, fields['reason'], fields['amount']);
            }
        }
    });
    gui.define_popup({name: 'popup_money_control', widget: popup_money_control});

    var popup_session = PopupWidget.extend({
        template: 'popup_session',
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .PutMoneyIn': 'put_money_in',
            'click .TakeMoneyOut': 'take_money_out',
            'click .SetClosingBalance': 'closing_balance',
            'click .EndOfSession': 'end_of_session',
            'click .ValidateClosingControl': 'onclick_vcpentries',
            'click .printstatement': 'print_pos_session_report'
        }),
        show: function (options) {
            var self = this;
            var session = options.session;
            this.session = session;
            if (this.session.state == 'closed') {
                this.pos.gui.show_popup('popup_sale_summary_session_report', {
                    title: 'Print Z-Report, Session Sale Summary',
                    body: 'Are you want print Z-Report (Your Session Sale Summary',
                    session_id: this.session.id,
                    cancel: function () {
                        self.pos.gui.close()
                    }
                })
            }
            this._super(options);
            $('.cancel').click(function () {
                self.pos.gui.close_popup();
            });
        },
        put_money_in: function () {
            var self = this;
            self.pos.gui.show_popup('popup_money_control', {
                'title': 'Put Money In',
                'body': 'Fill in this form if you put money in the cash register: ',
                confirm: function () {
                    var values = {};
                    values.reason = this.$('.reason').val();
                    values.amount = this.$('.amount').val();
                    values.session_id = self.pos.pos_session.id;

                    rpc.query({
                        model: 'cash.box.in',
                        method: 'cash_input_from_pos',
                        args: [0, values],
                    }).then(function (result) {
                        if (result)
                            self.pos.gui.show_popup('error', {
                                'title': 'Put Money In',
                                'body': JSON.stringify(result),
                            });
                        else
                            $('.session').trigger('click');
                    });
                },
                cancel: function () {
                    $('.session').trigger('click');
                }
            });
        },
        take_money_out: function () {
            var self = this;
            self.pos.gui.show_popup('popup_money_control', {
                'title': 'Take Money Out',
                'body': 'Describe why you take money from the cash register: ',
                confirm: function (reason, amount) {
                    var values = {
                        reason: reason,
                        amount: amount,
                        session_id: self.pos.pos_session.id
                    };
                    return rpc.query({
                        model: 'cash.box.out',
                        method: 'cash_input_from_pos',
                        args: [0, values],
                    }).then(function (result) {
                        if (result)
                            return self.pos.gui.show_popup('confirm', {
                                'title': 'Take Money Out',
                                'body': JSON.stringify(result),
                            });
                        else
                            return $('.session').trigger('click');
                    });
                },
                cancel: function () {
                    $('.session').trigger('click');
                }
            });
        },
        closing_balance: function (e) {
            var self = this;
            var tr = $(e.currentTarget);
            var balance = tr.attr('value');
            var check = "";
            rpc.query({
                model: 'pos.session',
                method: 'get_cashbox',
                args: [0, self.pos.pos_session.id, balance, check],
            }).then(function (result) {
                self.pos.gui.show_popup('popup_balance', {
                    'title': 'Cash Control',
                    'pos_cashbox_line': result,
                    confirm: function () {
                        var values = [];
                        var tbl = document.getElementById("cashbox-grid");
                        var row = tbl.getElementsByTagName("tbody")[0].getElementsByTagName("tr");
                        if (tbl != null) {
                            for (var i = 0; i < row.length - 1; i++) {
                                var id = null, number = null, coin_value = null;
                                var cell_count = row[i].cells.length;
                                for (var j = 0; j < cell_count ? 3 : 0; j++) {
                                    if (j == 0)
                                        id = row[i].cells[j].innerHTML;
                                    var children = row[i].cells[j].childNodes;
                                    for (var k = 0; k < children.length; k++) {
                                        if (children[k].value) {
                                            if (j == 1)
                                                coin_value = children[k].value;
                                            if (j == 2)
                                                number = children[k].value;
                                        }
                                    }
                                }
                                if (cell_count > 0)
                                    values.push({
                                        id: parseInt(id),
                                        number: parseFloat(number),
                                        coin_value: parseFloat(coin_value),
                                    });
                            }
                        }
                        rpc.query({
                            model: 'account.bank.statement.cashbox',
                            method: 'validate_from_ui',
                            args: [0, self.pos.pos_session.id, balance, values],
                        }).then(function (result) {
                            if (result)
                                self.pos.gui.show_popup('confirm', {
                                    'title': _t('Cash Control !!!!'),
                                    'body': JSON.stringify(result),
                                    'cancel': function () {
                                        $('.session').trigger('click');
                                    }
                                });
                            else
                                $('.session').trigger('click');
                        });
                    },
                    cancel: function () {
                        $('.session').trigger('click');
                    }
                });
            });
        },
        onclick_vcpentries: function () {
            var self = this;
            var id = self.pos.pos_session.id;
            this.gui.close_popup();
            rpc.query({
                model: 'pos.session',
                method: 'action_pos_session_validate',
                args: [id],
            }, {shadow: true}).done(function (result) {
                return self.pos.gui.show_popup('popup_sale_summary_session_report', {
                    title: 'Print Z-Report, Session Sale Summary',
                    body: 'Are you want print Z-Report (Your Session Sale Summary',
                    session_id: self.pos.pos_session.id,
                    cancel: function () {
                        self.pos.gui.close()
                    }
                })
            }).fail(function (err) {
                var err_msg = 'Please verify the details given or Check the Internet Connection./n';
                if (err.data.message)
                    err_msg = err.data.message;
                return self.gui.show_popup('alert', {
                    'title': _t('Odoo Warning'),
                    'body': _t(err_msg),
                    cancel: function () {
                    }
                });
            });
        },
        end_of_session: function () {
            var self = this;
            var id = self.pos.pos_session.id;
            var method = 'action_pos_session_close';
            if (this.pos.server_version != 10) {
                method = 'action_pos_session_closing_control'
            }
            this.gui.close_popup();
            rpc.query({
                model: 'pos.session',
                method: method,
                args: [id]
            }).then(function (result) {
                $('.session').trigger('click');
            }).fail(function (err) {
                var err_msg = 'Please verify the details given or Check the Internet Connection./n';
                if (err.data.message)
                    err_msg = err.data.message;
                self.gui.show_popup('alert', {
                    'title': _t('Odoo Warning'),
                    'body': _t(err_msg),
                });
            });
        },
        print_pos_session_report: function () {
            var self = this;
            var id = self.pos.pos_session.id;
            self.chrome.do_action('pos_retail.pos_session_report',
                {
                    additional_context: {active_ids: [id],}
                });
        }

    });
    gui.define_popup({name: 'popup_session', widget: popup_session});

});
