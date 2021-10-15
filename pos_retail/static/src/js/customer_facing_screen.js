/*
    This module create by: thanhchatvn@gmail.com
    License: OPL-1
    Please do not modification if i'm not accepted
 */
odoo.define('pos_retail.customer_facing_screen', function (require) {
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var qweb = core.qweb;
    // var utils = require('web.utils');
    // var core = require('web.core');
    // var round_pr = utils.round_precision;
    // var _t = core._t;
    // var rpc = require('pos.rpc');
    // var big_data = require('pos_retail.big_data');
    // var base = require('pos_retail.base');
    // var session = require('web.session');
    // var time = require('web.time');

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        // send_current_order_to_customer_facing_display: function () {
        //     var self = this;
        //     var rendered_html = qweb.render('customer_screen', {
        //         widget: this,
        //         images: []
        //     });
        //     this.proxy.update_customer_facing_display(rendered_html);
        // },
    })
});