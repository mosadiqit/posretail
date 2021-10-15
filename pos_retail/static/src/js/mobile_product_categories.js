odoo.define('pos_retail.mobile_product_categories', function (require) {
    var core = require('web.core');
    var qweb = core.qweb;
    var PosBaseWidget = require('point_of_sale.BaseWidget');

    var mobile_product_categories = PosBaseWidget.extend({
        template: 'mobile_product_categories',
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos_categories = options.pos_categories;
        },
        renderElement: function () {
            var self = this;
            this._super();
            if (this.pos_categories) {
                var categ_node = qweb.render('mobile_product_category_row', {
                    pos_categories: this.pos_categories,
                    widget: this
                });
                this.$el.find('tbody').html(categ_node);
            }
            this.$el.find('.category_row').on('click', function (event) {
                var categ_id = $(this).data('category-id');
                self.pos.category_selected = categ_id;
                self.click_category($(this).data('category-id'));
            });
        },
        click_category: function (categ_id) {
            var products = this.pos.db.get_product_by_category(categ_id);
            if (products.length) {
                this.gui.screen_instances.products.product_list_widget.set_product_list(products)
            } else {
                this.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Category clicked have not any products'
                })
            }
        },
    });
    return mobile_product_categories;
});