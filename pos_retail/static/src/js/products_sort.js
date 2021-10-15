odoo.define('pos_retail.products_sort', function (require) {
    var chrome = require('point_of_sale.chrome');
    var core = require('web.core');
    var _t = core._t;

    var products_sort_widget = chrome.StatusWidget.extend({
        template: 'products_sort_widget',
        start: function () {
            var self = this;
            this.$el.click(function () {
                var list = [
                    {
                        label: 'Sort from A to Z',
                        item: 'a_z'
                    },
                    {
                        label: 'Sort from Z to A',
                        item: 'z_a'
                    },
                    {
                        label: 'Sort from low to high price',
                        item: 'low_price'
                    },
                    {
                        label: 'Sort from high to low price',
                        item: 'high_price'
                    },
                    {
                        label: 'Product pos sequence',
                        item: 'pos_sequence'
                    }
                ];
                self.gui.show_popup('selection', {
                    title: _t('Select sort by'),
                    list: list,
                    confirm: function (item) {
                        if (item == 'a_z') {
                            self.pos.gui.show_popup('dialog', {
                                title: 'Done',
                                body: 'Products screen now sorted from A to Z',
                                color: 'success'
                            })
                        }
                        if (item == 'z_a') {
                            self.pos.gui.show_popup('dialog', {
                                title: 'Done',
                                body: 'Products screen now sorted from Z to A',
                                color: 'success'
                            })
                        }
                        if (item == 'low_price') {
                            self.pos.gui.show_popup('dialog', {
                                title: 'Done',
                                body: 'Products screen now sorted from low to high price',
                                color: 'success'
                            })
                        }
                        if (item == 'high_price') {
                            self.pos.gui.show_popup('dialog', {
                                title: 'Done',
                                body: 'Products screen now sorted high to low price',
                                color: 'success'
                            })
                        }
                        if (item == 'pos_sequence') {
                            self.pos.gui.show_popup('dialog', {
                                title: 'Done',
                                body: 'Products screen now sorted by sequence of product',
                                color: 'success'
                            })
                        }
                        self.pos.config.default_product_sort_by = item;
                        self.pos.trigger('update:categories');
                    }
                });
            });
        },
    });

    chrome.Chrome.include({
        build_widgets: function () {
            if (this.pos.config.active_product_sort_by) {
                this.widgets.push(
                    {
                        'name': 'products_sort_widget',
                        'widget': products_sort_widget,
                        'append': '.pos-branding'
                    }
                );
            }
            this._super();
        }
    });
});
