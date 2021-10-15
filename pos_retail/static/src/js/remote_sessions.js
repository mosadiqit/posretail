"use strict";
odoo.define('pos_retail.remote_sessions', function (require) {

    var models = require('point_of_sale.models');
    var exports = {};
    var Backbone = window.Backbone;
    var bus = require('pos_retail.core_bus');
    var rpc = require('pos.rpc');
    var indexed_db = require('pos_retail.indexedDB');

    exports.pos_remote_session = Backbone.Model.extend({
        initialize: function (pos) {
            this.pos = pos;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.on("notification", this, this.on_notification);
            this.bus.start_polling();
        },
        on_notification: function (notifications) {
            if (notifications && notifications[0] && notifications[0][1]) {
                for (var i = 0; i < notifications.length; i++) {
                    var channel = notifications[i][0][1];
                    if (channel == 'pos.remote_sessions') {
                        var value = JSON.parse(notifications[i][1]);
                        var session_id = value['session_id']
                        if (session_id == this.pos.pos_session['id']) {
                            if (value['remove_cache']) {
                                var self = this;
                                var status = new $.Deferred();
                                rpc.query({
                                    model: 'pos.call.log',
                                    method: 'search_read',
                                    domain: [],
                                    fields: ['call_results', 'call_model'],
                                }).then(function (values) {
                                    for (var i = 0; i < values.length; i++) {
                                        var value = values[i];
                                        if (value['call_results'] && value['call_model']) {
                                            var model = value['call_model'];
                                            var results = JSON.parse(value['call_results']);
                                            if (results.length) {
                                                indexed_db.write(model, results);
                                            }
                                        }
                                    }
                                    status.resolve();
                                    self.pos.reload_pos()
                                }).fail(function (e) {
                                    status.reject(e)
                                });
                                return status;
                            }
                            if (value['reload_session']) {
                                this.pos.reload_pos()
                            }
                            if (value['close_session']) {
                                this.pos.gui.close()
                            }
                            if (value['lock_session']) {
                                this.pos.gui.chrome.widget['lock_session_widget'].el.click();
                            }
                            if (value['unlock_session']) {
                                rpc.query({
                                    model: 'pos.config',
                                    method: 'lock_session',
                                    args: [[parseInt(this.pos.config.id)], {
                                        lock_state: 'unlock'
                                    }]
                                });
                                $('.pos-content').removeClass('oe_hidden');
                                $('.pos-topheader').removeClass('oe_hidden');
                                return this.pos.gui.close_popup();
                            }
                        }
                    }
                }
            }
        }
    });

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        load_server_data: function () {
            var self = this;
            return _super_PosModel.load_server_data.apply(this, arguments).then(function () {
                self.pos_remote_session = new exports.pos_remote_session(self);
                self.pos_remote_session.start();
            })
        }
    })

});
