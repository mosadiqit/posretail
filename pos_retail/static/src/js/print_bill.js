odoo.define('pos_retail.print_bill', function (require) {
    var chrome = require('point_of_sale.chrome');
    var core = require('web.core');
    var qweb = core.qweb;

    var print_bill_widget = chrome.StatusWidget.extend({
        template: 'print_bill_widget',
        start: function () {
            var self = this;
            this.$el.click(function () {
                var order = self.pos.get_order();
                if (order && order.orderlines.models.length != 0) {
                    self.pos.gui.show_screen('review_receipt');
                } else {
                    return self.pos.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Your shopping cart is empty'
                    })
                }
            });
        },
    });

    chrome.Chrome.include({
        build_widgets: function () {
            if (this.pos.config.receipt_without_payment_template != 'none') {
                this.widgets.push(
                    {
                        'name': 'print_bill_widget',
                        'widget': print_bill_widget,
                        'append': '.pos-branding'
                    }
                );
            }
            this._super();
        }
    });

});
