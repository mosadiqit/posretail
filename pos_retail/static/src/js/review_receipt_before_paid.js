odoo.define('pos_retail.screen_single', function (require) {
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var qweb = core.qweb;

    screens.ScreenWidget.include({
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.bind('change:selectedOrder', function () {
                var cur_screen = self.pos.gui.get_current_screen();
                if ((cur_screen == 'payment' || cur_screen == 'clientlist') && self.pos.config.review_receipt_before_paid) {
                    this.show_ticket();
                }
            }, this);
        },
        show: function () {
            var self = this;
            this._super();
            var cur_screen = this.pos.gui.get_current_screen();
            if ((cur_screen == 'payment' || cur_screen == 'clientlist') && this.pos.config.review_receipt_before_paid) {
                this.show_ticket();
            }
        },
        hide: function () {
            this._super();
            var cur_screen = this.pos.gui.get_current_screen();
            if ((cur_screen == 'payment' || cur_screen == 'clientlist') && this.pos.config.review_receipt_before_paid) {
                this.show_ticket();
            }
        },
        renderElement: function () {
            this._super();
            var cur_screen = this.pos.gui.get_current_screen();
            if ((cur_screen == 'payment' || cur_screen == 'clientlist') && this.pos.config.review_receipt_before_paid) {
                this.show_ticket();
            }
        },
        get_receipt_data: function () {
            var order = this.pos.get_order();
            var data_print = {
                widget: this,
                pos: this.pos,
                order: order,
                receipt: order.export_for_printing(),
                orderlines: order.get_orderlines(),
                paymentlines: order.get_paymentlines(),
            };
            var orderlines_by_category_name = {};
            var order = this.pos.get_order();
            var orderlines = order.orderlines.models;
            var categories = [];
            if (this.pos.config.category_wise_receipt) {
                for (var i = 0; i < orderlines.length; i++) {
                    var line = orderlines[i];
                    var pos_categ_id = line['product']['pos_categ_id']
                    if (pos_categ_id && pos_categ_id.length == 2 && order.get_root_category_by_category_id(pos_categ_id[0]) && this.pos.db.category_by_id[order.get_root_category_by_category_id(pos_categ_id[0])]) {
                        var root_category_id = order.get_root_category_by_category_id(pos_categ_id[0]);
                        var category = this.pos.db.category_by_id[root_category_id];
                        var category_name = category['name'];
                        if (!orderlines_by_category_name[category_name]) {
                            orderlines_by_category_name[category_name] = [line];
                            var category_index = _.findIndex(categories, function (category) {
                                return category == category_name;
                            });
                            if (category_index == -1) {
                                categories.push(category_name)
                            }
                        } else {
                            orderlines_by_category_name[category_name].push(line)
                        }

                    } else {
                        if (!orderlines_by_category_name['None']) {
                            orderlines_by_category_name['None'] = [line]
                        } else {
                            orderlines_by_category_name['None'].push(line)
                        }
                        var category_index = _.findIndex(categories, function (category) {
                            return category == 'None';
                        });
                        if (category_index == -1) {
                            categories.push('None')
                        }
                    }
                }
            }
            data_print['orderlines_by_category_name'] = orderlines_by_category_name;
            data_print['categories'] = categories;
            return data_print;
        },
        render_receipt: function () {
            if (!this.pos.config.mobile_responsive) {
                this.$('.pos-sale-ticket').replaceWith('');
                this.$('.screen-content').append(qweb.render('PosTicket', this.get_receipt_data()));
                var self = this;
                setTimeout(function () {
                    try {
                        var order = self.pos.get_order();
                        if (order && order['ean13'] && self.pos.config.barcode_receipt) {
                            self.$('img[id="barcode"]').removeClass('oe_hidden');
                            JsBarcode("#barcode", order['ean13'], {
                                format: "EAN13",
                                displayValue: true,
                                fontSize: 14
                            });
                        }
                        if (order.index_number_order && self.pos.config.show_order_unique_barcode) {
                            self.$('img[id="barcode_order_unique"]').removeClass('oe_hidden');
                            JsBarcode("#barcode_order_unique", order['index_number_order'], {
                                format: "EAN13",
                                displayValue: true,
                                fontSize: 14
                            });
                        }
                    } catch (error) {
                        console.error(error)
                    }
                }, 200)

            }
        },
        show_ticket: function () {
            if (this.pos.config.mobile_responsive) {
                return;
            }
            var cur_screen = this.pos.gui.get_current_screen();
            this.$('.pos-sale-ticket').replaceWith('');
            this.$('.screen-content').css({
                'width': '100%',
                'max-width': '100%'
            });
            this.$('.top-content').css({
                'left': '32%'
            });
            this.render_receipt();
            if (cur_screen == 'clientlist' || cur_screen == 'clientlist') {
                this.$('.full-content').css({
                    'left': '32%'
                })
            }
        }
    });
});
