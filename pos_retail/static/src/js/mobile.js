odoo.define('pos_retail.mobile', function (require) {
    "use strict";
    var chrome = require('point_of_sale.chrome');
    var gui = require('point_of_sale.gui');
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var rpc = require('pos.rpc');
    var core = require('web.core');
    var _t = core._t;

    gui.Gui.include({
        show_screen: function (screen_name, params, refresh, skip_close_popup) {
            if (screen_name != 'products') {
                $('.swiper-container').addClass('oe_hidden');
            } else {
                $('.swiper-container').removeClass('oe_hidden');
            }
            return this._super(screen_name, params, refresh, skip_close_popup);
        }
    });
    chrome.Chrome.include({
        build_widgets: function () {
            this._super();
            var self = this;
            if (this.pos.config.mobile_responsive) {
                new Swiper('.swiper-container');
                var products = $('.rightpane');
                products.detach();
                $(".swiper_product_widget").append(products);
                var order = $('.leftpane');
                order.detach();
                $('.swiper_order_widget').append(order);
                $('.pos').addClass('mobile');
                $('.screen').addClass('mobile');
                var action_buttons = this.pos.gui.screen_instances.products.action_buttons;
                for (var key in action_buttons) {
                    action_buttons[key].appendTo(this.$('.button-list'));
                }
                $('.set-customer').click(function () {
                    $('.swiper-container').addClass('oe_hidden');
                    self.pos.gui.show_screen('clientlist');
                });
                $('.pay').click(function () {
                    $('.swiper-container').addClass('oe_hidden');
                    var order = self.pos.get_order();
                    var has_valid_product_lot = _.every(order.orderlines.models, function (line) {
                        return line.has_valid_product_lot();
                    });
                    if (!has_valid_product_lot) {
                        self.pos.gui.show_popup('confirm', {
                            'title': _t('Empty Serial/Lot Number'),
                            'body': _t('One or more product(s) required serial/lot number.'),
                            confirm: function () {
                                self.pos.gui.show_screen('payment');
                            },
                        });
                    } else {
                        self.pos.gui.show_screen('payment');
                    }
                });
            } else {
                $('.swiper-container').replaceWith();
            }
        }
    });

    var mobile_widget = PosBaseWidget.extend({
        template: 'mobile_widget',
        init: function (parent, options) {
            options = options || {};
            this._super(parent, options);
            this.action = options.action;
            this.label = options.label;
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$el.click(function () {
                return self.gui.show_popup('confirm', {
                    title: 'Alert',
                    body: 'Are you want change to screen mode Mobile',
                    confirm: function () {
                        rpc.query({
                            model: 'pos.config',
                            method: 'switch_mobile_mode',
                            args: [parseInt(self.pos.config.id),
                                {
                                    mobile_responsive: !self.pos.config.mobile_responsive,
                                }
                            ]
                        }).then(function (result) {
                            self.pos.reload_pos();
                        }, function (type, err) {
                            self.pos.query_backend_fail(err);
                        });
                    }
                });
            });
        },
        show: function () {
            this.$el.removeClass('oe_hidden');
        },
        hide: function () {
            this.$el.addClass('oe_hidden');
        }
    });

    var pc_widget = PosBaseWidget.extend({
        template: 'pc_widget',
        init: function (parent, options) {
            options = options || {};
            this._super(parent, options);
            this.action = options.action;
            this.label = options.label;
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$el.click(function () {
                return self.gui.show_popup('confirm', {
                    title: 'Alert',
                    body: 'Are you want change to full screen mode',
                    confirm: function () {
                        return rpc.query({
                            model: 'pos.config',
                            method: 'switch_mobile_mode',
                            args: [parseInt(self.pos.config.id),
                                {
                                    mobile_responsive: !self.pos.config.mobile_responsive,
                                }
                            ]
                        }).then(function () {
                            self.pos.reload_pos();
                        }, function (err) {
                            self.pos.query_backend_fail(err);
                        });
                    }
                });
            });
        },
        show: function () {
            this.$el.removeClass('oe_hidden');
        },
        hide: function () {
            this.$el.addClass('oe_hidden');
        }
    });

    chrome.Chrome.include({
        build_widgets: function () {
            this.widgets = _.filter(this.widgets, function (widget) {
                return widget['name'] != 'mobile_widget';
            });
            if (!this.pos.config.mobile_responsive) {
                this.widgets.push(
                    {
                        'name': 'mobile_widget',
                        'widget': mobile_widget,
                        'append': '.pos-branding'
                    }
                );
            } else {
                this.widgets.push(
                    {
                        'name': 'pc_widget',
                        'widget': pc_widget,
                        'append': '.pos-rightheader'
                    }
                );
            }
            this._super();
        }
    });
});
