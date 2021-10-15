odoo.define('pos_retail.sync_stock', function (require) {
    var models = require('point_of_sale.models');
    var rpc = require('pos.rpc');
    var exports = {};
    var Backbone = window.Backbone;
    var bus = require('pos_retail.core_bus');

    exports.pos_sync_stock = Backbone.Model.extend({
        initialize: function (pos) {
            this.pos = pos;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.last = this.pos.db.load('bus_last', 0);
            this.bus.on("notification", this, this.on_notification);
            this.bus.start_polling();
        },
        on_notification: function (notifications) {
            if (notifications && notifications[0] && notifications[0][1]) {
                for (var i = 0; i < notifications.length; i++) {
                    var channel = notifications[i][0][1];
                    if (channel == 'pos.sync.stock') {
                        console.log('started sync: pos.sync.stock');
                        var product_ids = JSON.parse(notifications[i][1])['product_ids'];
                        this.pos._do_update_quantity_onhand(product_ids)
                    }
                }
            }
        }
    });

    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        load_server_data: function () {
            var self = this;
            return _super_posmodel.load_server_data.apply(this, arguments).then(function () {
                if (self.config.display_onhand) {
                    self.pos_sync_stock = new exports.pos_sync_stock(self);
                    self.pos_sync_stock.start();
                }
                return true;
            })
        },
        _do_update_quantity_onhand: function (product_ids) {
            console.log('_do_update_quantity_onhand product_ids: ' + product_ids);
            var self = this;
            var stock_location_ids = this.get_locations();
            if (stock_location_ids.length == 0 || !stock_location_ids) {
                return
            }
            return this._get_stock_on_hand_by_location_ids(product_ids, stock_location_ids).done(function (datas) {
                var products = [];
                for (var product_id in datas) {
                    var product = self.db.product_by_id[product_id];
                    if (product) {
                        products.push(product);
                        var qty_available = datas[product_id];
                        self.db.stock_datas[product['id']] = qty_available;
                        console.log('-> ' + product['display_name'] + ' qty_available : ' + qty_available)
                    }
                }
                if (products.length) {
                    self.gui.screen_instances["products"].do_update_products_cache(products);
                    self.gui.screen_instances["products_operation"].refresh_screen();
                }
            })
        },
    });
});
