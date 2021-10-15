"use strict";
odoo.define('pos_retail.screen_products_return', function (require) {

    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var qweb = core.qweb;

    var return_products = screens.ScreenWidget.extend({
        template: 'return_products',
        start: function () {
            this.products_return = [];
            this._super();
            this.render_screen();
        },
        show: function () {
            var self = this;
            this._super();
            var $search_box = this.$('.search_return_products >input');
            $search_box.autocomplete({
                source: this.pos.db.get_products_source(),
                minLength: this.pos.config.min_length_search,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var product_selected = self.pos.db.product_by_id[ui['item']['value']];
                        if (product_selected) {
                            self.add_product(product_selected);
                            setTimeout(function () {
                                self.$('.searchbox input')[0].value = '';
                                self.$('.searchbox input').focus();
                            }, 2000);
                        }
                    }
                }
            });
        },
        scan_return_product: function (datas) {
            var product_selected = this.pos.db.product_by_barcode[datas['code']];
            if (product_selected) {
                this.add_product(product_selected);
                return true;
            } else {
                this.barcode_error_action(datas);
                return false;
            }
        },
        add_product: function (product_selected) {
            var self = this;
            if (product_selected) {
                var product_exist = _.find(this.products_return, function (product) {
                    return product['id'] == product_selected['id']
                });
                var products = _.filter(this.products_return, function (product) {
                    return product['id'] != product_selected['id']
                });
                if (product_exist) {
                    if (!product_exist['quantity_return']) {
                        product_exist['quantity_return'] = 1
                    } else {
                        product_exist['quantity_return'] += 1
                    }

                } else {
                    product_selected['quantity_return'] = 1;
                    products.push(product_selected);
                    this.products_return = products;
                }
                this.render_products_return();
                setTimeout(function () {
                    self.$('.searchbox input')[0].value = '';
                }, 10);
            }
        },
        render_screen: function () {
            this.pos.invoice_selected = null;
            var self = this;
            this.$('.back').click(function () {
                self.gui.show_screen('products');
            });
            var $confirm_return = this.$('.confirm_return');
            $confirm_return.click(function () {
                if (self.products_return.length <= 0) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'List of lines is blank, please add products'
                    })
                }
                var order = new models.Order({}, {pos: self.pos});
                order['is_return'] = true;
                self.pos.get('orders').add(order);
                self.pos.set('selectedOrder', order);
                if (order) {
                    for (var i = 0; i < self.products_return.length; i++) {
                        var product = self.products_return[i];
                        var line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
                        line['is_return'] = true;
                        order.orderlines.add(line);
                        var price_return = product['price_return'] || product['list_price'];
                        line.set_unit_price(price_return);
                        line.set_quantity(-product['quantity_return'], 'keep price');
                    }
                    order.trigger('change', order);
                    return self.gui.show_screen('payment');
                }
            });
        },
        product_icon_url: function (id) {
            return '/web/image?model=product.product&id=' + id + '&field=image_small';
        },
        render_products_return: function () {
            var self = this;
            var contents = this.$el[0].querySelector('tbody');
            contents.innerHTML = "";
            for (var i = 0; i < this.products_return.length; i++) {
                var product = this.products_return[i];
                var product_html = qweb.render('product_return_row', {
                    widget: this,
                    product: product
                });
                product = document.createElement('tbody');
                product.innerHTML = product_html;
                product = product.childNodes[1];
                contents.appendChild(product);
            }
            this.$('.product_row .quantity').on('click', function () {
                var product_id = $(this).parent().parent().data()['id'];
                var product = _.find(self.products_return, function (product) {
                    return product['id'] == product_id;
                });
                self.product_selected = product;
                return self.pos.gui.show_popup('alert_input', {
                    title: _t('Quantity'),
                    body: 'Please input quantity need return',
                    confirm: function (quantity_return) {
                        var quantity_return = parseFloat(quantity_return);
                        self.product_selected['quantity_return'] = quantity_return;
                        self.render_products_return();
                    },
                })
            });
            this.$('.product_row .edit_amount').on('click', function () {
                var product_id = $(this).parent().parent().data()['id'];
                var product = _.find(self.products_return, function (product) {
                    return product['id'] == product_id;
                });
                self.product_selected = product;
                return self.pos.gui.show_popup('alert_input', {
                    title: _t('Amount return'),
                    body: 'Please input amount',
                    confirm: function (price_return) {
                        var price_return = parseFloat(price_return);
                        self.product_selected['price_return'] = price_return;
                        self.render_products_return();
                    },
                    cancel: function () {

                    }
                })
            });
            this.$('.product_row .remove').on('click', function () {
                var product_id = $(this).parent().parent().data()['id'];
                var products = _.filter(self.products_return, function (product) {
                    return product['id'] !== product_id;
                });
                self.products_return = products;
                self.render_products_return();
            });
        }

    });
    gui.define_screen({name: 'return_products', widget: return_products});

});
