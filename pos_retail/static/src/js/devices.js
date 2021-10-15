"use strict";
odoo.define('pos_retail.devices', function (require) {

    // **********************************************
    // **********************************************
    // **********************************************
    // **********************************************
    // Supported >= 2 millions datas products
    // **********************************************
    // **********************************************
    // **********************************************
    // **********************************************

    // var devices = require('point_of_sale.devices');
    // var utils = require('web.utils');
    // var round_pr = utils.round_precision;
    // var models = require('point_of_sale.models');
    // var indexed_db = require('pos_retail.indexedDB');
    //
    // var _super_BarcodeReader = devices.BarcodeReader.prototype;
    // devices.BarcodeReader = devices.BarcodeReader.extend({
    //     scan: function (code) {
    //         var self = this;
    //         self.code = code;
    //         var index_list = ['bc_index', 'dc_index', 'name_index']
    //         var max_sequence = this.pos.session.model_ids['product.product']['max_id'] / 100000 + 1;
    //         $.when(indexed_db.search_by_index('product.product', max_sequence, index_list, code)).done(function (product) {
    //             if (product['id']) {
    //                 var product_is_product_exsit = self.pos.db.product_by_id[product['id']];
    //                 if (!product_is_product_exsit) {
    //                     if (self.pos.server_version == 10) {
    //                         self.pos.db.add_products([product]);
    //                     }
    //                     if (self.pos.server_version == 11 || self.pos.server_version == 12) {
    //                         var using_company_currency = self.pos.config.currency_id[0] === self.pos.company.currency_id[0];
    //                         var conversion_rate = self.pos.currency.rate / self.pos.company_currency.rate;
    //                         self.pos.db.add_products(_.map([product], function (product) {
    //                             if (!using_company_currency) {
    //                                 product.lst_price = round_pr(product.lst_price * conversion_rate, self.pos.currency.rounding);
    //                             }
    //                             product.categ = _.findWhere(self.pos.product_categories, {'id': product.categ_id[0]});
    //                             return new models.Product({}, product);
    //                         }));
    //                     }
    //                 }
    //             }
    //         }).fail(function (error) {
    //             return _super_BarcodeReader.scan.call(self, self.code);
    //         }).done(function () {
    //             return _super_BarcodeReader.scan.call(self, self.code);
    //         })
    //     },
    // });

});
