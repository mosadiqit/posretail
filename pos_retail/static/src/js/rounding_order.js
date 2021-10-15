odoo.define('pos_retail.rounding_order', function (require) {
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        get_total_with_tax: function() {
            var sub_total = _super_order.get_total_with_tax.apply(this, arguments);
            if (this.pos.config.allow_auto_rounding == false) {
                return sub_total;
            } else {
                return round_pr(sub_total, this.pos.config.rounding);
            }
        },
        get_total_without_tax: function() {
            var sub_total = _super_order.get_total_without_tax.apply(this, arguments);
            if (this.pos.config.allow_auto_rounding == false) {
                return sub_total;
            } else {
                return round_pr(sub_total, this.pos.config.rounding);
            }
        },
        get_total_discount: function() {
            var sub_total = _super_order.get_total_discount.apply(this, arguments);
            if (this.pos.config.allow_auto_rounding == false) {
                return sub_total;
            } else {
                return round_pr(sub_total, this.pos.config.rounding);
            }
        },
        get_total_tax: function() {
            var sub_total = _super_order.get_total_tax.apply(this, arguments);
            if (this.pos.config.allow_auto_rounding == false) {
                return sub_total;
            } else {
                return round_pr(sub_total, this.pos.config.rounding);
            }
        },
        get_total_paid: function() {
            var sub_total = _super_order.get_total_paid.apply(this, arguments);
            if (this.pos.config.allow_auto_rounding == false) {
                return sub_total;
            } else {
                return round_pr(sub_total, this.pos.config.rounding);
            }
        },
    });

});
