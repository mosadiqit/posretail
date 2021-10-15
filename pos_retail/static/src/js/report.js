odoo.define('pos_retail.report', function (require) {
    "use strict";

    var gui = require('point_of_sale.gui');
    var screens = require('point_of_sale.screens');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('pos.rpc');
    var core = require('web.core');
    var _t = core._t;
    var QWeb = core.qweb;
    var chrome = require('point_of_sale.chrome');
    var field_utils = require('web.field_utils');

    var report_button_widget = chrome.StatusWidget.extend({
        template: 'report_button_widget',
        start: function () {
            var self = this;
            this.$el.click(function () {
                var list_report = [];
                if (self.pos.config.report_product_summary) {
                    list_report.push({
                        'label': 'Report Products Summary',
                        'item': 1
                    })
                }
                if (self.pos.config.report_order_summary) {
                    list_report.push({
                        'label': 'Report Orders Summary',
                        'item': 2
                    })
                }
                if (self.pos.config.report_payment_summary) {
                    list_report.push({
                        'label': 'Report Payment Summary',
                        'item': 3
                    })
                }
                if (list_report.length != 0) {
                    return self.gui.show_popup('selection', {
                        title: _t('Please select report need review'),
                        list: list_report,
                        confirm: function (report) {
                            if (report == 1) {
                                return self.gui.show_popup('popup_report_product_summary');
                            }
                            if (report == 2) {
                                return self.gui.show_popup('popup_report_order_summary');
                            }
                            if (report == 3) {
                                return self.gui.show_popup('popup_report_payment_summary');
                            }
                        },
                        cancel: function () {
                            debugger
                        }
                    });
                } else {
                    return self.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'You config have not any report'
                    })
                }

            });
        },
    });

    chrome.Chrome.include({
        build_widgets: function () {
            if (!this.pos.config.mobile_responsive) {
                this.widgets.push(
                    {
                        'name': 'report_button_widget',
                        'widget': report_button_widget,
                        'append': '.pos-branding'
                    }
                );
            }
            this._super();
        }
    });

    var popup_report_payment_summary = PopupWidget.extend({
        template: 'popup_report_payment_summary',
        show: function (options) {
            var self = this;
            options = options || {};
            this._super(options);
            this.$('.datepicker').datetimepicker({
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
            this.$('.confirm').click(function () {
                self.click_confirm();
            });
            this.$('.cancel').click(function () {
                self.gui.close_popup();
            });
            var today_date = new Date().toISOString().split('T')[0];
            var date = new Date();
            var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            var first_date_of_month = firstDay.toISOString().split('T')[0];
            if (this.pos.config.report_payment_current_month_date) {
                this.$('input#from_date').val(first_date_of_month);
                this.$('input#to_date').val(today_date);
            }
            this.$('input#current_session_report').click(function () {
                if ($(this).prop("checked") == true) {
                    self.$(".date_input_container").hide();
                } else if ($(this).prop("checked") == false) {
                    self.$(".date_input_container").show();
                }
            });
        },
        show_report: function (journal_details, salesmen_details, summary_data) {
            this.pos.report_html = QWeb.render('report_payment_summary_html', {
                widget: this,
                pos: this.pos,
                journal_details: journal_details,
                salesmen_details: salesmen_details,
                summary_data: summary_data
            });
            this.pos.report_xml = QWeb.render('report_payment_summary_xml', {
                widget: this,
                pos: this.pos,
                journal_details: journal_details,
                salesmen_details: salesmen_details,
                summary_data: summary_data
            });
            this.gui.show_screen('report');
        },
        click_confirm: function () {
            var self = this;
            var fields = {};
            this.$('.popup_field').each(function (idx, el) {
                if (el.name == 'current_session_report') {
                    fields[el.name] = self.$('input#current_session_report').prop("checked")
                } else {
                    fields[el.name] = el.value || false;
                }
            });
            var from_date = fields['from_date'];
            var to_date = fields['to_date'];
            var summary = fields['summary'];
            if (fields['current_session_report'] == true) {
                var pos_session_id = self.pos.pos_session.id;
                var val = {
                    'summary': summary,
                    'session_id': pos_session_id,
                    'pos_branch_id': null
                };
                if (self.pos.config.pos_branch_id) {
                    val['pos_branch_id'] = self.pos.config.pos_branch_id[0]
                }
                var params = {
                    model: 'pos.order',
                    method: 'payment_summary_report',
                    args: [val],
                };
                return rpc.query(params, {async: false}).then(function (res) {
                    if (res) {
                        if (Object.keys(res['journal_details']).length == 0 && Object.keys(res['salesmen_details']).length == 0) {
                            self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'No record found'
                            })
                        } else {
                            var journal_key = Object.keys(res['journal_details']);
                            if (journal_key.length > 0) {
                                var journal_details = res['journal_details'];
                            } else {
                                var journal_details = false;
                            }
                            var sales_key = Object.keys(res['salesmen_details']);
                            if (sales_key.length > 0) {
                                var salesmen_details = res['salesmen_details'];
                            } else {
                                var salesmen_details = false;
                            }
                            var total = Object.keys(res['summary_data']);
                            if (total.length > 0) {
                                var summary_data = res['summary_data'];
                            } else {
                                var summary_data = false;
                            }
                            self.show_report(journal_details, salesmen_details, summary_data)
                        }
                    }
                });
            } else {
                if (from_date == "" && to_date == "" || from_date != "" && to_date == "" || from_date == "" && to_date != "") {
                    if (!from_date) {
                        return this.wrong_input('input[name="from_date"]', "(*) From date is required");
                    } else {
                        this.passed_input('input[name="from_date"]');
                    }
                    if (!to_date) {
                        return this.wrong_input('input[name="to_date"]', "(*) To date is required");
                    } else {
                        this.passed_input('input[name="to_date"]');
                    }
                } else if (from_date > to_date) {
                    this.wrong_input('input[name="from_date"]', "(*) From date required smaller than To date");
                    return this.wrong_input('input[name="to_date"]', "(*) From date required smaller than To date");
                }
                var val = {
                    'from_date': from_date,
                    'to_date': to_date,
                    'summary': summary,
                    'pos_branch_id': null
                };
                if (self.pos.config.pos_branch_id) {
                    val['pos_branch_id'] = self.pos.config.pos_branch_id[0]
                }
                var params = {
                    model: 'pos.order',
                    method: 'payment_summary_report',
                    args: [val],
                };
                this.from_date = fields['from_date'];
                this.to_date = fields['to_date'];
                return rpc.query(params, {async: false}).then(function (res) {
                    if (res) {
                        if (Object.keys(res['journal_details']).length == 0 && Object.keys(res['salesmen_details']).length == 0) {
                            self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'No record found'
                            })
                        } else {
                            var journal_key = Object.keys(res['journal_details']);
                            if (journal_key.length > 0) {
                                var journal_details = res['journal_details'];
                            } else {
                                var journal_details = false;
                            }
                            var sales_key = Object.keys(res['salesmen_details']);
                            if (sales_key.length > 0) {
                                var salesmen_details = res['salesmen_details'];
                            } else {
                                var salesmen_details = false;
                            }
                            var total = Object.keys(res['summary_data']);
                            if (total.length > 0) {
                                var summary_data = res['summary_data'];
                            } else {
                                var summary_data = false;
                            }
                            self.pos.report_html = QWeb.render('report_payment_summary_html', {
                                widget: self,
                                pos: self.pos,
                                journal_details: journal_details,
                                salesmen_details: salesmen_details,
                                summary_data: summary_data
                            });
                            self.show_report(journal_details, salesmen_details, summary_data)
                        }
                    }
                });
            }
        },
    });
    gui.define_popup({name: 'popup_report_payment_summary', widget: popup_report_payment_summary});

    var popup_report_order_summary = PopupWidget.extend({
        template: 'popup_report_order_summary',
        show: function (options) {
            options = options || {};
            this._super(options);
            this.$('.datepicker').datetimepicker({
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
            this.$('.confirm').click(function () {
                self.click_confirm();
            });
            this.$('.cancel').click(function () {
                self.gui.close_popup();
            });
            var self = this;
            var today_date = new Date().toISOString().split('T')[0];
            var date = new Date();
            var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            var first_date = firstDay.toISOString().split('T')[0];
            if (this.pos.config.report_order_current_month_date) {
                this.$('input#from_date').val(first_date);
                this.$('input#to_date').val(today_date);
            }
            this.$("#from_date").change(function () {
                if (self.$("#from_date").val()) {
                    self.$('input[name="from_date"]').css('border', '');
                }
            });
            this.$("#to_date").change(function () {
                if (self.$("#to_date").val()) {
                    self.$('input[name="to_date"]').css('border', '');
                }
            });
            this.$('input#current_session_report').click(function () {
                if ($(this).prop("checked") == true) {
                    self.$(".date_input_container").hide();
                } else if ($(this).prop("checked") == false) {
                    self.$(".date_input_container").show();
                }
            });
        },
        show_report: function (state, from_date, to_date, total_categ_amount, total_amount, order_report, category_report, payment_report) {
            this.pos.report_html = QWeb.render('report_order_summary_html', {
                state: state,
                from_date: from_date,
                to_date: to_date,
                widget: this,
                pos: this.pos,
                total_categ_amount: total_categ_amount,
                total_amount: total_amount,
                order_report: order_report,
                category_report: category_report,
                payment_report: payment_report,
            });
            this.pos.report_xml = QWeb.render('report_order_summary_xml', {
                state: state,
                from_date: from_date,
                to_date: to_date,
                widget: this,
                pos: this.pos,
                total_categ_amount: total_categ_amount,
                total_amount: total_amount,
                order_report: order_report,
                category_report: category_report,
                payment_report: payment_report,
            });
            this.gui.show_screen('report');
        },
        click_confirm: function () {
            var self = this;
            var value = {};
            var fields = {};
            this.$('.popup_field').each(function (idx, el) {
                if (el.name == 'current_session_report') {
                    fields[el.name] = self.$('input#current_session_report').prop("checked")
                } else if (el.name == 'order_summary_report') {
                    fields[el.name] = self.$('input#order_summary_report').prop("checked")
                } else if (el.name == 'category_summary_report') {
                    fields[el.name] = self.$('input#category_summary_report').prop("checked")
                } else if (el.name == 'payment_summary_report') {
                    fields[el.name] = self.$('input#payment_summary_report').prop("checked")
                }
                if (el.name != 'current_session_report' && el.name != 'order_summary_report' && el.name != 'category_summary_report' && el.name != 'payment_summary_report') {
                    fields[el.name] = el.value || false;
                }
            });
            var state = fields['state'];
            var report_list = [];
            if (fields['order_summary_report']) {
                report_list.push('order_summary_report')
            }
            if (fields['category_summary_report']) {
                report_list.push('category_summary_report')
            }
            if (fields['payment_summary_report']) {
                report_list.push('payment_summary_report')
            }
            if (fields.no_of_copies <= 0) {
                return this.wrong_input('input[name="no_of_copies"]', "(*) Missed No of Copies or smaller than or equal 0");
            }
            if (!fields['state']) {
                fields['state'] = '';
            }
            if (fields['current_session_report'] == true) {
                var pos_session_id = self.pos.pos_session.id;
                value = {
                    'from_date': fields['from_date'],
                    'to_date': fields['to_date'],
                    'state': state,
                    'summary': report_list,
                    'session_id': pos_session_id,
                    'pos_branch_id': null,
                };
                if (self.pos.config.pos_branch_id) {
                    value['pos_branch_id'] = self.pos.config.pos_branch_id[0]
                }
                var params = {
                    model: 'pos.order',
                    method: 'order_summary_report',
                    args: [value],
                };
                return rpc.query(params, {async: false}).then(function (res) {
                    var state = res['state'];
                    if (res) {
                        if (Object.keys(res['category_report']).length == 0 && Object.keys(res['order_report']).length == 0 &&
                            Object.keys(res['payment_report']).length == 0) {
                            self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'No record found'
                            })
                        } else {
                            var total_categ_amount = 0.00;
                            var total_amount = 0.00;
                            if (res['category_report']) {
                                if (self.pos.state) {
                                    _.each(res['category_report'], function (value, key) {
                                        total_categ_amount += value[1];
                                    });
                                }
                            }
                            if (res['payment_report']) {
                                if (self.pos.state) {
                                    _.each(res['payment_report'], function (value, key) {
                                        total_amount += value;
                                    });
                                }
                            }
                            var category_report;
                            var order_report;
                            var payment_report;
                            if (Object.keys(res.order_report).length == 0) {
                                order_report = false;
                            } else {
                                order_report = res['order_report']
                            }
                            if (Object.keys(res.category_report).length == 0) {
                                category_report = false;
                            } else {
                                category_report = res['category_report']
                            }
                            if (Object.keys(res.payment_report).length == 0) {
                                payment_report = false;
                            } else {
                                payment_report = res['payment_report']
                            }
                            for (var i = 0; i < fields['no_of_copies']; i++) {
                                self.show_report(state, false, false, total_categ_amount, total_amount, order_report, category_report, payment_report)
                            }
                        }
                    }
                });
            } else {
                if (fields.from_date == "" && fields.to_date == "" || fields.from_date != "" && fields.to_date == "" || fields.from_date == "" && fields.to_date != "") {
                    if (fields.from_date == "") {
                        return this.wrong_input('input[name="from_date"]', "(*) From Date is required");
                    } else {
                        this.passed_input('input[name="from_date"]');
                    }
                    if (fields.to_date == "") {
                        return this.wrong_input('input[name="to_date"]', "(*) To Date is required");
                    } else {
                        this.passed_input('input[name="to_date"]');
                    }
                } else if (fields.from_date > fields.to_date) {
                    this.wrong_input('input[name="from_date"]', "(*) From/To Date is required and From Date required smaller than To Date");
                    return this.wrong_input('input[name="to_date"]', "(*) From/To Date is required and From Date required smaller than To Date");
                }
                value = {
                    'from_date': fields.from_date,
                    'to_date': fields.to_date,
                    'state': state,
                    'summary': report_list,
                    'pos_branch_id': null
                };
                if (self.pos.config.pos_branch_id) {
                    value['pos_branch_id'] = self.pos.config.pos_branch_id[0]
                }
                var params = {
                    model: 'pos.order',
                    method: 'order_summary_report',
                    args: [value],
                };
                this.from_date = fields.from_date;
                this.to_date = fields.to_date;
                return rpc.query(params, {async: false}).then(function (res) {
                    var state = res['state'];
                    if (res) {
                        if (Object.keys(res['category_report']).length == 0 && Object.keys(res['order_report']).length == 0 &&
                            Object.keys(res['payment_report']).length == 0) {
                            self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'No record found'
                            })
                        } else {
                            self.pos.print_date = true;
                            var total_categ_amount = 0.00;
                            var total_amount = 0.00;
                            if (res['category_report']) {
                                if (self.pos.state) {
                                    _.each(res['category_report'], function (value, key) {
                                        total_categ_amount += value[1];
                                    });
                                }
                            }
                            if (res['payment_report']) {
                                if (self.pos.state) {
                                    _.each(res['payment_report'], function (value, key) {
                                        total_amount += value;
                                    });
                                }
                            }
                            var category_report;
                            var order_report;
                            var payment_report;
                            if (Object.keys(res.order_report).length == 0) {
                                order_report = false;
                            } else {
                                order_report = res['order_report']
                            }
                            if (Object.keys(res.category_report).length == 0) {
                                category_report = false;
                            } else {
                                category_report = res['category_report']
                            }
                            if (Object.keys(res.payment_report).length == 0) {
                                payment_report = false;
                            } else {
                                payment_report = res['payment_report']
                            }
                            for (var i = 0; i < fields['no_of_copies']; i++) {
                                self.show_report(state, self.from_date, self.to_date, total_categ_amount, total_amount, order_report, category_report, payment_report)
                            }
                        }
                    }
                });
            }
        },
    });
    gui.define_popup({name: 'popup_report_order_summary', widget: popup_report_order_summary});

    var popup_report_product_summary = PopupWidget.extend({
        template: 'popup_report_product_summary',
        show: function (options) {
            options = options || {};
            this._super(options);
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
            this.$('.confirm').click(function () {
                self.click_confirm();
            });
            this.$('.cancel').click(function () {
                self.gui.close_popup();
            });
            var self = this;
            self.pos.signature = false;
            var today_date = new Date().toISOString().split('T')[0];
            var date = new Date();
            var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            var first_date_of_month = firstDay.toISOString().split('T')[0];
            if (this.pos.config.report_product_current_month_date) {
                this.$('input#from_date').val(first_date_of_month);
                this.$('input#to_date').val(today_date);
            }
            this.$("#from_date").change(function () {
                if (self.$("#from_date").val() != "") {
                    self.$('input[name="from_date"]').css('border', '');
                }
            });
            this.$("#to_date").change(function () {
                if (self.$("#to_date").val() != "") {
                    self.$('input[name="to_date"]').css('border', '');
                }
            });
            if (this.pos.config.signature) {
                self.pos.signature = true;
            }
            this.$('input#current_session_report').click(function () {
                if ($(this).prop("checked") == true) {
                    self.$(".date_input_container").hide();
                } else if ($(this).prop("checked") == false) {
                    self.$(".date_input_container").show();
                }
            });
        },
        show_report: function (
            from_date,
            to_date,
            product_total_qty,
            category_total_qty,
            payment_summary_total,
            product_summary,
            category_summary,
            payment_summary,
            location_summary) {
            this.pos.report_html = QWeb.render('report_product_summary_html', {
                widget: this,
                pos: this.pos,
                from_date: from_date,
                to_date: to_date,
                product_total_qty: product_total_qty,
                category_total_qty: category_total_qty,
                payment_summary_total: payment_summary_total,
                product_summary: product_summary,
                category_summary: category_summary,
                payment_summary: payment_summary,
                location_summary: location_summary,
            });
            this.pos.report_xml = QWeb.render('report_product_summary_xml', {
                widget: this,
                pos: this.pos,
                from_date: from_date,
                to_date: to_date,
                product_total_qty: product_total_qty,
                category_total_qty: category_total_qty,
                payment_summary_total: payment_summary_total,
                product_summary: product_summary,
                category_summary: category_summary,
                payment_summary: payment_summary,
                location_summary: location_summary,
            });
            this.gui.show_screen('report');
        },
        click_confirm: function () {
            var self = this;
            var report_value = [];
            var fields = {};
            this.$('.popup_field').each(function (idx, el) {
                if (el.name == 'current_session_report') {
                    fields[el.name] = self.$('input#current_session_report').prop("checked")
                } else if (el.name == 'product_summary') {
                    fields[el.name] = self.$('input#product_summary').prop("checked")
                } else if (el.name == 'category_summary') {
                    fields[el.name] = self.$('input#category_summary').prop("checked")
                } else if (el.name == 'location_summary') {
                    fields[el.name] = self.$('input#location_summary').prop("checked")
                } else if (el.name == 'payment_summary') {
                    fields[el.name] = self.$('input#payment_summary').prop("checked")
                }
                if (el.name != 'current_session_report' && el.name != 'product_summary' && el.name != 'category_summary' && el.name != 'location_summary' && el.name != 'payment_summary') {
                    fields[el.name] = el.value || false;
                }
            });
            if (fields.no_of_copies <= 0) {
                return this.wrong_input('input[name="no_of_copies"]', '(*) Field No of Copies required bigger than 0');
            }
            if (fields['product_summary']) {
                report_value.push('product_summary')
            }
            if (fields['product_summary']) {
                report_value.push('category_summary')
            }
            if (fields['product_summary']) {
                report_value.push('location_summary')
            }
            if (fields['product_summary']) {
                report_value.push('payment_summary')
            }
            var from_date = fields.from_date;
            var to_date = fields.to_date;
            this.from_date = from_date;
            this.to_date = to_date;
            if (fields.current_session_report) {
                var pos_session_id = self.pos.pos_session.id;
                var val = {
                    'from_date': null,
                    'to_date': null,
                    'summary': report_value,
                    'session_id': pos_session_id,
                    'pos_branch_id': null,
                };
                if (this.pos.config.pos_branch_id) {
                    val['pos_branch_id'] = this.pos.config.pos_branch_id[0]
                }
                var params = {
                    model: 'pos.order',
                    method: 'product_summary_report',
                    args: [val],
                };
                this.from_date = null;
                this.to_date = null;
                return rpc.query(params, {async: false}).then(function (res) {
                    if (res) {
                        if (Object.keys(res['category_summary']).length == 0 && Object.keys(res['product_summary']).length == 0 &&
                            Object.keys(res['location_summary']).length == 0 && Object.keys(res['payment_summary']).length == 0) {
                            self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'No record found'
                            })
                        } else {
                            var product_total_qty = 0.0;
                            var category_total_qty = 0.0;
                            var payment_summary_total = 0.0;
                            if (res['product_summary']) {
                                _.each(res['product_summary'], function (value, key) {
                                    product_total_qty += value;
                                });
                            }
                            if (res['category_summary']) {
                                _.each(res['category_summary'], function (value, key) {
                                    category_total_qty += value;
                                });
                            }
                            if (res['payment_summary']) {
                                _.each(res['payment_summary'], function (value, key) {
                                    payment_summary_total += value;
                                });
                            }
                            var product_summary_key = Object.keys(res['product_summary']);
                            if (product_summary_key.length == 0) {
                                var product_summary = false;
                            } else {
                                var product_summary = res['product_summary'];
                            }
                            var category_summary_key = Object.keys(res['category_summary']);
                            if (category_summary_key.length == 0) {
                                var category_summary = false;
                            } else {
                                var category_summary = res['category_summary'];
                            }
                            var payment_summary_key = Object.keys(res['payment_summary']);
                            if (payment_summary_key.length == 0) {
                                var payment_summary = false;
                            } else {
                                var payment_summary = res['payment_summary'];
                            }
                            var location_summary_key = Object.keys(res['location_summary']);
                            if (location_summary_key.length == 0) {
                                var location_summary = false;
                            } else {
                                var location_summary = res['location_summary'];
                            }
                            for (var step = 0; step < fields.no_of_copies; step++) {
                                self.show_report(
                                    self.from_date,
                                    self.to_date,
                                    product_total_qty,
                                    category_total_qty,
                                    payment_summary_total,
                                    product_summary,
                                    category_summary,
                                    payment_summary,
                                    location_summary
                                )
                            }
                        }
                    }
                });
            } else {
                if (from_date == "" && to_date == "" || from_date != "" && to_date == "" || from_date == "" && to_date != "") {
                    if (from_date == "") {
                        return this.wrong_input('input[name="from_date"]', '(*) From Date required');
                    } else {
                        this.passed_input('input[name="from_date"]');
                    }
                    if (to_date == "") {
                        return this.wrong_input('input[name="to_date"]', "(*) To Date is required");
                    } else {
                        this.passed_input('input[name="to_date"]');
                    }
                } else if (from_date > to_date) {
                    this.wrong_input('input[name="from_date"]');
                    return this.wrong_input('input[name="to_date"]', '(*) From Date could not bigger than To Date');
                } else {
                    var val = {
                        'from_date': from_date,
                        'to_date': to_date,
                        'summary': report_value,
                        'pos_branch_id': null
                    };
                    if (this.pos.config.pos_branch_id) {
                        val['pos_branch_id'] = this.pos.config.pos_branch_id[0]
                    }
                    var params = {
                        model: 'pos.order',
                        method: 'product_summary_report',
                        args: [val],
                    };
                    rpc.query(params, {async: false}).then(function (res) {
                        if (res) {
                            if (Object.keys(res['category_summary']).length == 0 && Object.keys(res['product_summary']).length == 0 &&
                                Object.keys(res['location_summary']).length == 0 && Object.keys(res['payment_summary']).length == 0) {
                                self.pos.gui.show_popup('confirm', {
                                    title: 'Warning',
                                    body: 'No record found'
                                })
                            } else {
                                var product_total_qty = 0.0;
                                var category_total_qty = 0.0;
                                var payment_summary_total = 0.0;
                                if (res['product_summary']) {
                                    _.each(res['product_summary'], function (value, key) {
                                        product_total_qty += value;
                                    });
                                }
                                if (res['category_summary']) {
                                    _.each(res['category_summary'], function (value, key) {
                                        category_total_qty += value;
                                    });
                                }
                                if (res['payment_summary']) {
                                    _.each(res['payment_summary'], function (value, key) {
                                        payment_summary_total += value;
                                    });
                                }
                                var product_summary_key = Object.keys(res['product_summary']);
                                if (product_summary_key.length == 0) {
                                    var product_summary = false;
                                } else {
                                    var product_summary = res['product_summary'];
                                }
                                var category_summary_key = Object.keys(res['category_summary']);
                                if (category_summary_key.length == 0) {
                                    var category_summary = false;
                                } else {
                                    var category_summary = res['category_summary'];
                                }
                                var payment_summary_key = Object.keys(res['payment_summary']);
                                if (payment_summary_key.length == 0) {
                                    var payment_summary = false;
                                } else {
                                    var payment_summary = res['payment_summary'];
                                }
                                var location_summary_key = Object.keys(res['location_summary']);
                                if (location_summary_key.length == 0) {
                                    var location_summary = false;
                                } else {
                                    var location_summary = res['location_summary'];
                                }
                                for (var step = 0; step < fields.no_of_copies; step++) {
                                    self.show_report(
                                        from_date,
                                        to_date,
                                        product_total_qty,
                                        category_total_qty,
                                        payment_summary_total,
                                        product_summary,
                                        category_summary,
                                        payment_summary,
                                        location_summary
                                    )
                                }

                            }
                        }
                    });
                }
            }
        },
    });
    gui.define_popup({name: 'popup_report_product_summary', widget: popup_report_product_summary});

    var report = screens.ScreenWidget.extend({
        template: 'report',
        show: function () {
            this._super();
            this.render_receipt();
            this.handle_auto_print();
            this.auto_print_network(); // TODO: supported module pos_retail_network_printer
        },
        handle_auto_print: function () {
            if (this.should_auto_print()) {
                this.print();
            } else {
                this.lock_screen(false);
            }
        },
        auto_print_network: function () {
            if (this.pos.epson_printer_default && this.pos.report_xml) {
                this.pos.print_network(this.pos.report_xml, this.pos.epson_printer_default['ip']);
            }
        },
        should_auto_print: function () {
            return this.pos.config.iface_print_auto;
        },
        lock_screen: function (locked) {
            this._locked = locked;
            if (locked) {
                this.$('.back').removeClass('highlight');
            } else {
                this.$('.back').addClass('highlight');
            }
        },
        print_web: function () {
            window.print();
        },
        print_xml: function () {
            var self = this;
            this.pos.proxy.print_receipt(this.pos.report_xml);
            if (!this.pos.report_xml) {
                setTimeout(function () {
                    self.print_web();
                }, 500)
            }
        },
        print: function () {
            var self = this;
            if (!this.pos.config.iface_print_via_proxy) {
                this.lock_screen(true);
                setTimeout(function () {
                    self.lock_screen(false);
                }, 1000);
                this.print_web();
            } else {
                this.print_xml();
                this.lock_screen(false);
            }
            this.auto_print_network()
        },
        click_back: function () {
            this.pos.gui.show_screen('products')
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back').click(function () {
                if (!self._locked) {
                    self.click_back();
                }
                self.pos.trigger('back:order');
            });
            this.$('.button.print').click(function () {
                self.print();
            });
        },
        render_receipt: function () {
            this.$('.pos-receipt-container').html(this.pos.report_html);
        }
    });

    gui.define_screen({name: 'report', widget: report});

    var popup_sale_summary_session_report = PopupWidget.extend({
        template: 'popup_sale_summary_session_report',
        show: function (options) {
            var self = this;
            options = options || {};
            this.session_id = options.session_id;
            if (!this.session_id) {
                this.session_id = this.pos.pos_session.id
            }
            this._super(options);
        },
        show_report: function (report) {
            var self = this;
            var vals = {
                widget: this,
                pos: this.pos,
                report: report,
            };
            this.pos.report_html = QWeb.render('report_sale_summary_session_html', vals);
            this.pos.report_xml = QWeb.render('report_sale_summary_session_xml', vals);
            this.gui.show_screen('report');
            setTimeout(function () {
                self.pos.gui.show_popup('confirm', {
                    title: 'Are you want close session ?',
                    body: 'If you need close session and leave pos screen, please click Confirm button',
                    confirm: function () {
                        self.pos.gui.close()
                    }
                })
            }, 5000)
        },
        click_confirm: function () {
            var self = this;
            var params = {
                model: 'pos.session',
                method: 'build_sessions_report',
                args: [[this.session_id]],
            };
            return rpc.query(params, {shadow: true}).then(function (values) {
                self.show_report(values[self.session_id])
            }).fail(function (err) {
                self.pos.query_backend_fail(err);
            });
        },
    });
    gui.define_popup({name: 'popup_sale_summary_session_report', widget: popup_sale_summary_session_report});

    var button_show_sale_summary_session_report = screens.ActionButtonWidget.extend({ // combo button
        template: 'button_show_sale_summary_session_report',
        button_click: function () {
            var self = this;
            var params = {
                model: 'pos.session',
                method: 'build_sessions_report',
                args: [[this.pos.pos_session.id]],
            };
            return rpc.query(params, {shadow: true}).then(function (values) {
                self.show_report(values[self.pos.pos_session.id])
            }).fail(function (err) {
                self.pos.query_backend_fail(err);
            });
        },
        show_report: function (report) {
            var start_at = field_utils.parse.datetime(report.session.start_at);
            start_at = field_utils.format.datetime(start_at);
            report['start_at'] = start_at;
            if (report['stop_at']) {
                var stop_at = field_utils.parse.datetime(report.session.stop_at);
                stop_at = field_utils.format.datetime(stop_at);
                report['stop_at'] = stop_at;
            }
            var vals = {
                widget: this,
                pos: this.pos,
                report: report,
            };
            this.pos.report_html = QWeb.render('report_sale_summary_session_html', vals);
            this.pos.report_xml = QWeb.render('report_sale_summary_session_xml', vals);
            this.gui.show_screen('report');
        },
    });

    screens.define_action_button({
        'name': 'button_show_sale_summary_session_report',
        'widget': button_show_sale_summary_session_report,
        'condition': function () {
            return true;
        }
    });
});
