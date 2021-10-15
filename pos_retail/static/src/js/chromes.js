odoo.define('pos_retail.chromes', function (require) {
    "use strict";

    var chrome = require('point_of_sale.chrome');
    var core = require('web.core');
    var _t = core._t;
    var session = require('web.session');

    var button_list_widget = chrome.StatusWidget.extend({
        template: 'button_list_widget',
        init: function () {
            this._super(arguments[0], {});
            this.show = true;
        },
        start: function () {
            var self = this;
            this._super();
            $('.show_hide_buttons').click(function () {
                var current_screen = self.pos.gui.get_current_screen();
                if (current_screen == 'products') {
                    if (self.pos.show_left_buttons == true || self.pos.show_left_buttons == undefined) {
                        $('.buttons_pane').animate({width: 0}, 'fast');
                        $('.leftpane').animate({left: 0}, 'fast');
                        $('.rightpane').animate({left: 440}, 'fast');
                        $('.fa fa-list').toggleClass('highlight');
                        $('.show_hide_buttons .fa-list').toggleClass('fa-list fa-th');
                        self.pos.show_left_buttons = false;
                    } else {
                        $('.buttons_pane').animate({width: 170}, 'fast');
                        $('.leftpane').animate({left: 0}, 'fast');
                        $('.rightpane').animate({left: 605}, 'fast');
                        $('.show_hide_buttons .fa-th').toggleClass('fa-th fa-list');
                        self.pos.show_left_buttons = true;
                    }
                }
            });
        }
    });
    chrome.Chrome.include({
        build_widgets: function () {
            if (!this.pos.config.mobile_responsive) {
                this.widgets = _.filter(this.widgets, function (widget) {
                    return widget['name'] != 'button_list_widget';
                });
                this.widgets.push(
                    {
                        'name': 'button_list_widget',
                        'widget': button_list_widget,
                        'append': '.pos-branding',
                    }
                );
            }
            this._super();
        }
    });

    chrome.OrderSelectorWidget.include({ // TODO: validate delete order
        deleteorder_click_handler: function (event, $el) {
            if (this.pos.config.validate_remove_order) {
                this.pos._validate_by_manager('this.pos.delete_current_order()')
            } else {
                return this._super()
            }
        },
        renderElement: function () {
            this._super();
            if (!this.pos.config.allow_remove_order || this.pos.config.allow_remove_order == false || this.pos.config.staff_level == 'marketing' || this.pos.config.staff_level == 'waiter' || this.pos.config.is_customer_screen) {
                this.$('.deleteorder-button').replaceWith('');
            }
            if (!this.pos.config.allow_add_order || this.pos.config.allow_add_order == false || this.pos.config.is_customer_screen) {
                this.$('.neworder-button').replaceWith('');
            }
            if (this.pos.config.is_customer_screen) {
                $('.pos .order-selector').css('display', 'none');
                $('.pos-branding').css('display', 'none');
                $('.debug-widget').css('display', 'none');
            }
        }
    });

    chrome.HeaderButtonWidget.include({
        renderElement: function () {
            var self = this;
            this._super();
            if (this.action) {
                this.$el.click(function () {
                    if (self.pos.config.close_session) {
                        session.rpc("/web/session/destroy", {});
                        window.open("/web/login", "_self");
                    }
                    if (self.pos.config.validate_close_session) {
                        self.pos._validate_by_manager('this.pos.gui.close()');
                    } else {
                        self.action();
                    }
                });
            }
        }
    })
});
