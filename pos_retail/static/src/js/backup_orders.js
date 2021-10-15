"use strict";
odoo.define('pos_retail.backup_orders', function (require) {

    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var chrome = require('point_of_sale.chrome');
    var PopupWidget = require('point_of_sale.popups');
    var gui = require('point_of_sale.gui');
    var core = require('web.core');
    var _t = core._t;
    var rpc = require('pos.rpc');
    var models = require('point_of_sale.models');

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        init_from_JSON: function (json) { // may be pos session close and account bank statement removed out of pos current session
            var paymentlines = json.statement_ids; // and so, if out side current session, statement payment of customer will remove
            for (var i = 0; i < paymentlines.length; i++) {
                var paymentline = paymentlines[i][2];
                var cashregister = this.pos.cashregisters_by_id[paymentline.statement_id];
                if (!cashregister) {
                    json.statement_ids = _.filter(json.statement_ids, function (statement) {
                        return statement[2]['statement_id'] != paymentline.statement_id;
                    })
                }
            }
            _super_Order.init_from_JSON.apply(this, arguments);
        }
    });

    models.PosModel = models.PosModel.extend({
        import_pending_order: function (str) {
            var json = JSON.parse(str);
            var report = {
                paid: 0,
                unpaid: 0,
                unpaid_skipped_existing: 0,
                unpaid_skipped_session: 0,
                unpaid_skipped_sessions: [],
            };
            var exist_orders = 0;
            var existing = this.get_order_list();
            var existing_uids = {};

            for (var i = 0; i < existing.length; i++) {
                existing_uids[existing[i].uid] = true;
            }
            if (json.length <= 0) {
                return this.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Your file attachment have not any orders, please checking file name for correct file need import'
                })
            } else {

            }
            for (var i = 0; i < json.length; i++) {
                var order = json[i]['data'];
                if (!existing_uids[order['uid']]) {
                    var new_order = new models.Order({}, {
                        pos: this,
                        json: order,
                    })
                    this.get('orders').add(new_order);
                    report['paid'] += 1
                } else {
                    exist_orders += 1
                }
            }
            if (exist_orders) {
                this.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Have total exist orders : ' + exist_orders
                })
            }
            return report;
        }
    });

    var BackUpOrdersWidget = PosBaseWidget.extend({
        template: 'BackUpOrdersWidget',
        init: function (parent, options) {
            options = options || {};
            this._super(parent, options);
            this.action = options.action;
            this.label = options.label;
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$el.click(function () {
                self.pos.gui.show_popup('popup_backup_orders', {})
            });
        },
        show: function () {
            this.$el.removeClass('oe_hidden');
        },
        hide: function () {
            this.$el.addClass('oe_hidden');
        }
    });
    chrome.Chrome.include({
        build_widgets: function () {
            this.widgets = _.filter(this.widgets, function (widget) {
                return widget['name'] != 'BackUpOrdersWidget';
            });
            if (this.pos.config.backup) {
                this.widgets.push(
                    {
                        'name': 'backup_order_widget',
                        'widget': BackUpOrdersWidget,
                        'append': '.pos-branding'
                    }
                );
            }
            this._super();
        }
    });
    var popup_backup_orders = PopupWidget.extend({
        template: 'popup_backup_orders',
        show: function (options) {
            var self = this;
            this._super(options);
            this.$('.backup_orders_via_file').click(function () {
                return self.gui.prepare_download_link(
                    self.pos.export_unpaid_orders(),
                    _t("unpaid orders") + ' ' + moment().format('YYYY-MM-DD-HH-mm-ss') + '.json',
                    ".backup_orders_via_file", ".download_backup_orders"
                );
            });
            this.$('.restore_orders input').on('change', function (event) {
                var file = event.target.files[0];
                if (file) {
                    var reader = new FileReader();
                    reader.onload = function (event) {
                        var report = self.pos.import_orders(event.target.result);
                        self.gui.show_popup('orderimport', {report: report});
                    };
                    reader.readAsText(file);
                }
            });
            this.$('.backup_orders_via_backend').click(function () {
                return rpc.query({
                    model: 'pos.config',
                    method: 'write',
                    args: [[parseInt(self.pos.config.id)], {
                        backup_orders: self.pos.export_unpaid_orders()
                    }]
                }).then(function (result) {
                    if (result == true) {
                        self.pos.gui.show_popup('dialog', {
                            title: 'Saved',
                            body: 'File saved succeed',
                            color: 'info'
                        })
                    }
                }, function (err) {
                    self.pos.query_backend_fail(err);
                });
            });

            this.$('.backup_pending_order').click(function () {
                return self.gui.prepare_download_link(
                    self.pos.db.get_orders(),
                    _t("pending orders") + ' ' + moment().format('YYYY-MM-DD-HH-mm-ss') + '.json',
                    ".backup_orders_via_file", ".download_backup_orders"
                );
            });
            this.$('.restore_pending_order').on('change', function (event) {
                var file = event.target.files[0];
                if (file) {
                    var reader = new FileReader();
                    reader.onload = function (event) {
                        var report = self.pos.import_pending_order(event.target.result);
                        self.gui.show_popup('orderimport', {report: report});
                    };
                    reader.readAsText(file);
                }
            });
            this.$('.restore_orders_via_backend').click(function () {
                return rpc.query({
                    model: 'pos.config',
                    method: 'search_read',
                    domain: [['id', '=', self.pos.config.id]],
                    fields: ['backup_orders']
                }).then(function (results) {
                    if (results[0] && results[0]['backup_orders'] != '') {
                        var report = self.pos.import_orders(results[0]['backup_orders']);
                        return self.gui.show_popup('orderimport', {report: report});
                    } else {
                        self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Nothing order restore'
                        })
                    }
                }, function (err) {
                    self.pos.query_backend_fail(err);
                });
            });

            this.$('.close').click(function () {
                self.pos.gui.close_popup();
            });
        }
    });
    gui.define_popup({name: 'popup_backup_orders', widget: popup_backup_orders});
});

