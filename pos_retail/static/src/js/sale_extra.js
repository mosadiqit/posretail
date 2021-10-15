odoo.define('pos_retail.sale_extra', function (require) {
    var models = require('point_of_sale.models');
    var core = require('web.core');
    var qweb = core.qweb;
    var screens = require('point_of_sale.screens');

    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            var product_model = _.find(this.models, function (model) {
                return model.model === 'product.product';
            });
            product_model.fields.push('sale_extra');
            return _super_posmodel.initialize.apply(this, arguments);
        }
    });
    models.Order = models.Order.extend({
        get_product_image_url: function (product) {
            return window.location.origin + '/web/image?model=product.product&field=image_medium&id=' + product.id;
        }
    });

    screens.OrderWidget.include({
       remove_orderline: function (order_line) {
            try {
                order_line.display_products_sale_extra(true);
                this._super(order_line);
            } catch (ex) {
                console.log('dont worries, client without table select');
            }
        },
    });
    var _super_order_line = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function (attributes, options) {
            var res = _super_order_line.initialize.apply(this, arguments);
            var self = this;
            this.product_sale_extra_click_handler = function (event) {
                self.set_sale_extra_to_line(this.orderline, this.sale_extra_id);
            };
            return res;
        },
        set_sale_extra_to_line: function (selected_line, sale_extra_id) {
            var sale_extra = this.pos.sale_extra_by_id[sale_extra_id]
            if (!sale_extra) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Could not find extra item just selected, Please remove your browse cache and restart session'
                })
            }
            var product_id = sale_extra['product_id'][0];
            var order = this.pos.get_order();

            if (product_id && order) {
                var selected_line = order.get_selected_orderline();
                var product = this.pos.db.get_product_by_id(product_id);
                if (product) {
                    order.add_product(product, {
                        quantity: sale_extra['quantity'],
                        price: sale_extra['list_price'],
                        merge: false,
                    });
                }
                order.select_orderline(selected_line)
            }
        },
        set_selected: function (selected) {
            _super_order_line.set_selected.apply(this, arguments);
            this.display_products_sale_extra();
        },
        display_products_sale_extra: function (removed) {
            var contents = $('.product-list-sale-extra');
            if (this.product && this.selected && this.product['sale_extra']) {
                var sales_extra = this.pos.sale_extra_by_product_tmpl_id[this.product['product_tmpl_id']];
                if (sales_extra && sales_extra.length > 0 && contents) {
                    contents.empty();
                    contents.css({'display': 'inherit'});
                    for (var i = 0; i < sales_extra.length; i++) {
                        var sale_extra = sales_extra[i];
                        var product = this.pos.db.get_product_by_id(sale_extra['product_id'][0]);
                        if (product) {
                            var image_url = this.order.get_product_image_url(product);
                            var el_str = qweb.render('product_sale_extra', {
                                widget: this.pos.chrome,
                                product: product,
                                sale_extra: sale_extra,
                                image_url: image_url
                            });
                            var el_node = document.createElement('div');
                            el_node.innerHTML = _.str.trim(el_str);
                            el_node = el_node.childNodes[0];
                            el_node.orderline = this;
                            el_node.sale_extra_id = sale_extra['id'];
                            el_node.addEventListener('click', this.product_sale_extra_click_handler);
                            var list_container = document.querySelector('.product-list-sale-extra');
                            if (list_container) {
                                list_container.appendChild(el_node);
                            }
                        }
                    }
                } else if ((!sales_extra && contents) || sales_extra.length == 0) {
                    contents.css({'display': 'none'});
                }
            }
            if (removed) {
                contents.css({'display': 'none'})
            }
            if (this.selected == false) {
                contents.css({'display': 'none'})
            }
        }
    });
});
