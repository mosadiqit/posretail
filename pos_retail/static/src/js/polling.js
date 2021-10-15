"use strict";
odoo.define('pos_retail.polling', function (require) {

    var Backbone = window.Backbone;
    var session = require('web.session');
    var models = require('point_of_sale.models');
    var exports = {};

    // exports.Polling_Connection = Backbone.Model.extend({
    //     initialize: function (pos) {
    //         this.pos = pos;
    //     },
    //     polling_on: function () {
    //         this.pos.set('sync_backend', {state: 'connected', pending: 0});
    //     },
    //     polling_off: function () {
    //         if (this.pos.config.sync_multi_session) {
    //             if (!this.pos.config.user_id) {
    //                 console.warn('This session config sync between sessions but not assigned to any user, please re-config');
    //             } else {
    //                 console.warn('Longpolling not work with your domain please check your nginx and apache');
    //             }
    //         }
    //         this.pos.set('sync_backend', {state: 'disconnected', pending: 1});
    //     },
    //     ping: function () {
    //         var self = this;
    //         var params = {
    //             pos_id: this.pos.config.id,
    //             messages: 'Hello polling master',
    //         };
    //         var sending = function () {
    //             return session.rpc("/pos/test/polling", params);
    //         };
    //         return sending().fail(function (error) {
    //             console.error('Polling not work: ' + error.message);
    //             self.polling_off();
    //         }).done(function () {
    //             console.log('Polling working');
    //             self.polling_on();
    //         })
    //     }
    // });
    //
    // var _super_PosModel = models.PosModel.prototype;
    // models.PosModel = models.PosModel.extend({
    //     load_server_data: function () {
    //         var self = this;
    //         return _super_PosModel.load_server_data.apply(this, arguments).then(function () {
    //             self.polling = new exports.Polling_Connection(self);
    //             return true;
    //         }).done(function () {
    //             setInterval(function () {
    //                 self.polling.ping();
    //             }, 60000);
    //         })
    //     }
    // })
});
