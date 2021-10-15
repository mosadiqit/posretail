odoo.define('pos_retail.products_view', function (require) {
    var chrome = require('point_of_sale.chrome');

    var products_view_widget = chrome.StatusWidget.extend({
        template: 'products_view_widget',
        render_view: function () {
            this.gui.screen_instances['products'].rerender_products_screen(this.view_type);
        },
        start: function () {
            var self = this;
            this.view_type = this.pos.config.product_view;
            this.pos.bind('change:set_product_view', function (pos, datas) {
                self.set_status(datas.state, datas.pending);
            });
            this.$el.click(function () {
                if (self.view_type == 'box') {
                    self.view_type = 'list';
                } else {
                    self.view_type = 'box';
                }
                if (self.view_type == 'box') {
                    self.pos.set('set_product_view', {state: 'connected', pending: 0});
                    self.render_view(self.view_type);
                } else {
                    self.pos.set('set_product_view', {state: 'connecting', pending: 0});
                    self.render_view(self.view_type);
                }
            });
        },
    });

    chrome.Chrome.include({
        build_widgets: function () {
            this.widgets.push(
                {
                    'name': 'products_view_widget',
                    'widget': products_view_widget,
                    'append': '.pos-branding'
                }
            );
            this._super();
        }
    });
});
