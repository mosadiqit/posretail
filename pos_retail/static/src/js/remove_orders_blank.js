odoo.define('pos_retail.remove_orders_blank', function (require) {
    var chrome = require('point_of_sale.chrome');
    var models = require('point_of_sale.models');

    var remove_orders_blank_widget = chrome.StatusWidget.extend({
        template: 'remove_orders_blank_widget',
        start: function () {
            var self = this;
            this.$el.click(function () {
                var orders = self.pos.get('orders');
                var removed = 0;
                for (var i = 1; i < orders.models.length; i++) {
                    var order = orders.models[i];
                    if (order.orderlines.models.length == 0) {
                        order.destroy({'reason': 'abandon'});
                        removed += 1
                    }
                }
                if (removed == 0) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Your session have not orders blank'
                    });
                } else {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Alert',
                        body: 'We just removed all orders blank lines',
                        color: 'success'
                    });
                }
            });
        },
    });

    chrome.Chrome.include({
        build_widgets: function () {
            if (!this.pos.config.mobile_responsive) {
                this.widgets.push(
                    {
                        'name': 'remove_orders_blank_widget',
                        'widget': remove_orders_blank_widget,
                        'append': '.pos-branding'
                    }
                );
            }
            this._super();
        }
    });
});
