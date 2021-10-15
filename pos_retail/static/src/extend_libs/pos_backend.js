odoo.define('pos_retail.pos_backend', function (require) {
    "use strict";

    var WebClient = require('web.WebClient');
    var core = require('web.core');
    var _t = core._t;
    var Backbone = window.Backbone;
    var bus = require('pos_retail.core_bus');
    var rpc = require('web.rpc');
    var exports = {};

    var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;

    if (!indexedDB) {
        window.alert("Your browser doesn't support a stable version of IndexedDB.")
    }

    exports.auto_drop_database = Backbone.Model.extend({
        initialize: function (web_client) {
            this.web_client = web_client;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.on("notification", this, this.on_notification);
            this.bus.start_polling();
        },
        on_notification: function (notifications) {
            var self = this;
            if (notifications && notifications[0] && notifications[0][1]) {
                for (var i = 0; i < notifications.length; i++) {
                    var channel = notifications[i][0][1];
                    if (channel == 'pos.remote_sessions') {
                        var data = JSON.parse(notifications[i][1]);
                        if (data['message']) {
                            this.web_client.do_notify(_t('Alert'),
                                _t(data['message']));
                        }
                        if (data['open_session']) {
                            window.open('/pos/web?config_id=' + data['config_id'], '_self');
                        }
                        if (data['remove_cache']) {
                            this.web_client.remove_indexed_db();
                        }
                        if (data['validate_and_post_entries']) {
                            return rpc.query({
                                model: 'pos.config',
                                method: 'validate_and_post_entries_session',
                                args: [[data['config_id']]],
                                context: {}
                            }).then(function () {
                                self.web_client.do_notify(_t('Alert'),
                                    _t('Your pos session just validated and post entries by your manager'));
                            })
                        }
                    }
                }
            }
        }
    });

    WebClient.include({
        remove_indexed_db: function (dbName) {
            for (var i = 0; i <= 100; i++) {
                indexedDB.deleteDatabase(dbName + '_' + i);
            }
            this.do_notify(_t('Alert'),
                _t('Admin drop pos database:' + dbName));
        },
        show_application: function () {
            this.auto_drop_database = new exports.auto_drop_database(this);
            this.auto_drop_database.start();
            return this._super.apply(this, arguments).then(function () {
                return true
            });
        }
    });
});
