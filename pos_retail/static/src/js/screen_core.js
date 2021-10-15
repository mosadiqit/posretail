"use strict";
odoo.define('pos_retail.screens', function (require) {

    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var qweb = core.qweb;

    var TablesScreenWidget = screens.ScreenWidget.extend({
        template: 'TableScreenWidget',
        init: function (parent, options) {
            this._super(parent, options);
        },
        start: function () {
            var self = this;
            this._super();
            this.pos.bind('update:table-list', function () {
                self.renderElement();
            })
        },
        renderElement: function () {
            var self = this;
            this._super();
            var orders = this.pos.get('orders').models;
            var current_order = this.pos.get('selectedOrder');
            for (var i = 0; i < orders.length; i++) {
                var table = orders[i].table;
                if (table) {
                    var tablewidget = $(qweb.render('Table', {
                        widget: this,
                        table: table,
                    }));
                    tablewidget.data('id', table.id);
                    this.$('.table-items').append(tablewidget);
                    if (current_order) {
                        if (current_order.uid == orders[i].uid) {
                            tablewidget.css('background', 'rgb(110,200,155)');
                        }
                    }
                }
            }
            this.$('.table-item').on('click', function () {
                var table_id = parseInt($(this).data()['id']);
                self.clickTable(table_id);
                $(this).css('background', 'rgb(110,200,155)');
            });
        },
        get_order_by_table: function (table) {
            var orders = this.pos.get('orders').models;
            var order = orders.find(function (order) {
                if (order.table) {
                    return order.table.id == table.id;
                }
            });
            return order;
        },
        clickTable: function (table_id) {
            var self = this;
            var tables = self.pos.tables_by_id;
            var table = tables[table_id];
            if (table) {
                var order_click = this.get_order_by_table(table)
                if (order_click) {
                    this.pos.set('selectedOrder', order_click);
                    order_click.trigger('change', order_click);
                }
            }
            var items = this.$('.table-item');
            for (var i = 0; i < items.length; i++) {
                if (parseInt($(items[i]).data()['id']) != table_id) {
                    $(items[i]).css('background', '#ffff');
                }
            }
        }
    });

    screens.NumpadWidget.include({
        hide_pad: function () {
            $('.subwindow-container-fix .pads').animate({height: 0}, 'fast');
            $('.numpad').addClass('oe_hidden');
            $('.show_hide_pad').toggleClass('fa-caret-down fa-caret-up');
            $('.actionpad').addClass('oe_hidden');
            $('.mode-button').addClass('oe_hidden');
            this.pos.hide_pads = true;
        },
        show_pad: function () {
            $('.subwindow-container-fix .pads').animate({height: '100%'}, 'fast');
            $('.mode-button').removeClass('oe_hidden');
            $('.actionpad').removeClass('oe_hidden');
            $('.pads').animate({height: '100%'}, 'fast');
            $('.show_hide_pad').toggleClass('fa-caret-down fa-caret-up');
            $('.numpad').removeClass('oe_hidden');
            this.pos.hide_pads = false;
        },
        renderElement: function () {
            var self = this;
            this._super();
            $('.pad').click(function () {
                if (!self.pos.hide_pads || self.pos.hide_pads == false) {
                    self.hide_pad();
                } else {
                    self.show_pad();
                }
            });
            this.pos.bind('change:selectedOrder', function () {
                if (self.pos.hide_pads) {
                    self.hide_pad();
                }
            }, this);
        },
        clickChangeMode: function (event) {
            var self = this;
            var newMode = event.currentTarget.attributes['data-mode'].nodeValue;
            var order = this.pos.get_order();
            if (!order) {
                return this._super(event);
            }
            var line_selected = order.get_selected_orderline();
            if (!line_selected) {
                return this._super(event);
            }
            var is_return = order['is_return'];
            if (newMode == 'quantity' && this.pos.config.validate_quantity_change) {
                if (is_return) {
                    if (!this.pos.config.apply_validate_return_mode) {
                        return this._super(event);
                    } else {
                        this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('quantity')");
                    }
                } else {
                    this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('quantity')");
                }
            }
            if (newMode == 'discount' && this.pos.config.validate_discount_change) {
                if (is_return) {
                    if (!this.pos.config.apply_validate_return_mode) {
                        return this._super(val);
                    } else {
                        this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('discount')");
                    }
                } else {
                    this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('discount')");
                }
            }
            if (newMode == 'price' && this.pos.config.validate_price_change) {
                if (is_return) {
                    if (!this.pos.config.apply_validate_return_mode) {
                        return this._super(val);
                    } else {
                        this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('price')");
                    }

                } else {
                    this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('price')");
                }
            }
            return this._super(event);
        }
    });

    screens.ActionButtonWidget.include({
        highlight: function (highlight) {
            this._super(highlight);
            if (highlight) {
                this.$el.addClass('highlight');
            } else {
                this.$el.removeClass('highlight');
            }
        },
        altlight: function (altlight) {
            this._super(altlight);
            if (altlight) {
                this.$el.addClass('btn-info');
            } else {
                this.$el.removeClass('btn-info');
            }
        },
        invisible: function () {
            this.$el.addClass('oe_hidden');
        },
        display: function () {
            this.$el.removeClass('oe_hidden');
        }
    });

    screens.ScreenWidget.include({
        _check_is_duplicate: function (field_value, field_string, id) {
            var partners = this.pos.db.get_partners_sorted(-1);
            if (id) {
                var old_partners = _.filter(partners, function (partner_check) {
                    return partner_check['id'] != id && partner_check[field_string] == field_value;
                });
                if (old_partners.length != 0) {
                    return true
                } else {
                    return false
                }
            } else {
                var old_partners = _.filter(partners, function (partner_check) {
                    return partner_check[field_string] == field_value;
                });
                if (old_partners.length != 0) {
                    return true
                } else {
                    return false
                }
            }
        },
        validate_date_field: function (value, $el) {
            if (value.match(/^\d{4}$/) !== null) {
                $el.val(value + '-');
            } else if (value.match(/^\d{4}\/\d{2}$/) !== null) {
                $el.val(value + '-');
            }
        },
        check_is_number: function (number) {
            var regex = /^[0-9]+$/;
            if (number.match(regex)) {
                return true
            } else {
                return false
            }
        },
        wrong_input: function (element, message) {
            if (message) {
                this.$("span[class='card-issue']").text(message);
            }
            this.$el.find(element).css({
                'box-shadow': '0px 0px 0px 1px rgb(236, 5, 5) inset',
                'border': 'red !important'
            });
        },
        passed_input: function (element) {
            this.$el.find(element).css({
                'box-shadow': '0px 0px 0px 1px rgb(34, 206, 3) inset'
            })
        },
        show: function () {
            var self = this;
            this._super();
            $('.pos-logo').replaceWith();
            // this.pos.barcode_reader.set_action_callback('order', _.bind(this.scan_order_and_return, this));
            // this.pos.barcode_reader.set_action_callback('fast_order_number', _.bind(this.barcode_fast_order_number, this));
            if (this.pos.config.is_customer_screen) {
                $('.pos .order-selector').css('display', 'none');
                $('.pos .leftpane').css('left', '0px');
                $('.pos .rightpane').css('left', '600px');
                $('.username').replaceWith();
                $('.js_synch').replaceWith();
                $('.oe_icon').css("padding-right", '60px');
                $('.pos-rightheader').css("right", '0px');
                $('.pos-rightheader').css("float", 'right');
                $('.pos-rightheader').css("left", 'auto');
                $('.find_customer').replaceWith();
                $('.full-content').css("top", '10px');
                $('.show_hide_buttons').remove();
                $('.layout-table').replaceWith();
                $('.buttons_pane').replaceWith();
                $('.collapsed').replaceWith();
                var image_url = window.location.origin + '/web/image?model=pos.config.image&field=image&id=';
                var images = self.pos.images;
                for (var i = 0; i < images.length; i++) {
                    images[i]['image_url'] = 'background-image:url(' + image_url + images[i]['id'] + ')';
                }
                this.$('.rightpane').append(qweb.render('customer_screen', {
                    widget: this,
                    images: images
                }));
                new Swiper('.gallery-top', {
                    spaceBetween: 10,
                    speed: this.pos.config.delay,
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev'
                    },
                    autoplay: {
                        delay: 4000,
                        disableOnInteraction: false
                    }
                });
                new Swiper('.gallery-thumbs', {
                    speed: this.pos.config.delay,
                    spaceBetween: 10,
                    centeredSlides: true,
                    slidesPerView: 'auto',
                    touchRatio: 0.2,
                    slideToClickedSlide: true,
                    autoplay: {
                        delay: 4000,
                        disableOnInteraction: false
                    }
                });
            }
        },
        scan_booked_order: function(datas_code) {
            var sale = this.pos.db.sale_order_by_ean13[datas_code.code];
            if (sale) {
                this.gui.screen_instances['sale_orders'].display_sale_order(sale);
                return true
            } else {
                return false
            }
        },
        barcode_product_action: function (code) {
            var current_screen = this.pos.gui.get_current_screen();
            var scan_sussess = false;
            if (current_screen && current_screen == 'return_products') {
                scan_sussess = this.scan_return_product(code);
            }
            if (current_screen == 'sale_orders') {
                scan_sussess = this.scan_booked_order(code)
            }
            if (current_screen != 'return_products' && current_screen != 'sale_orders' && !scan_sussess) {
                return this._super(code)
            }
        },
        scan_order_and_paid: function (datas_code) {
            if (datas_code && datas_code['type']) {
                var code = datas_code['code'];
                console.log('{scanner} code: ' + code);
                var orders = this.pos.get('orders').models;
                var order = _.find(orders, function (order) {
                    return order.index_number_order == code;
                });
                if (order) {
                    this.pos.set('selectedOrder', order);
                    this.pos.gui.show_screen('payment');
                    return true;
                } else {
                    return false
                }
            } else {
                return false;
            }
        },
        scan_order_and_return: function (datas_code) {
            if (datas_code && datas_code['type']) {
                console.log('{scanner} return order code: ' + datas_code.code);
            }
            var ean13 = datas_code['code'];
            if (ean13.length == 12)
                ean13 = "0" + ean13;
            var order = this.pos.db.order_by_ean13[ean13];
            if (!order || order.length > 1) {
                return false; // could not find order
            }
            var order_lines = this.pos.db.lines_by_order_id[order['id']];
            if (!order_lines) {
                return false;
            } else {
                this.gui.show_popup('popup_return_pos_order_lines', {
                    title: order.name,
                    order_lines: order_lines,
                    order: order
                });
                return true
            }
        },
        barcode_error_action: function (datas_code_wrong) {
            var check_is_return_order = this.scan_order_and_return(datas_code_wrong);
            if (!check_is_return_order) {
                var fast_selected_order = this.scan_order_and_paid(datas_code_wrong);
                if (!fast_selected_order) {
                    return this._super(datas_code_wrong)
                }
            }
        }
    });

    screens.ScaleScreenWidget.include({
        _get_active_pricelist: function () {
            var current_order = this.pos.get_order();
            var current_pricelist = this.pos.default_pricelist;
            if (current_order && current_order.pricelist) {
                return this._super()
            } else {
                return current_pricelist
            }
        },
        _get_default_pricelist: function () {
            var current_pricelist = this.pos.default_pricelist;
            return current_pricelist
        }
    });
    screens.ActionpadWidget.include({
        /*
                validation payment
                auto ask need apply promotion
                auto ask when have customer special discount
         */
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.add-new-customer').click(function () {
                self.pos.gui.show_popup('popup_create_customer', {
                    title: 'Add customer'
                })
            });
            this.$('.find-order').click(function () {
                self.pos.show_purchased_histories();
            });
            this.$('.quickly_paid').click(function () {
                if (!self.pos.config.quickly_payment_full_journal_id) {
                    return;
                }
                var order = self.pos.get_order();
                if (!order) {
                    return;
                }
                if (order.orderlines.length == 0) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Error',
                        body: 'Your order lines is blank'
                    })
                }
                var paymentlines = order.get_paymentlines();
                for (var i = 0; i < paymentlines.length; i++) {
                    paymentlines[i].destroy();
                }
                var register = _.find(self.pos.cashregisters, function (register) {
                    return register['journal']['id'] == self.pos.config.quickly_payment_full_journal_id[0];
                });
                if (!register) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Error',
                        body: 'Your config not add quickly payment method, please add before use'
                    })
                }
                var amount_due = order.get_due();
                order.add_paymentline(register);
                var selected_paymentline = order.selected_paymentline;
                selected_paymentline.set_amount(amount_due);
                order.initialize_validation_date();
                self.pos.push_order(order);
                self.pos.gui.show_screen('receipt');

            });
            this.$('.pay').click(function () {
                var order = self.pos.get_order();
                order.validate_payment_order();
                // TODO: we will process it in the future, made all screens to one screen
                // if (self.pos.config.replace_payment_screen && !self.pos.mobile_responsive && order.orderlines.models.length) {
                //     var payment_screen = new screens.PaymentScreenWidget(self, {});
                //     payment_screen.replace($('.payment-screen-container'));
                //     payment_screen.show(); // add keyboard event
                //     $( "input" ).prop( "disabled", true );
                //     $(".pos .pad").css( {"pointer-events": "none"});
                //     $(".pos .pads .numpad").css( {"pointer-events": "none"});
                //     // $(".header-row").addClass("oe_hidden");
                //     $(".orderline").css( {"pointer-events": "none"});
                //     $(".pos .actionpad button").css( {"pointer-events": "none"});
                //     $(".pos .actionpad span").css( {"pointer-events": "none"});
                //     $('.screen').addClass('hide_receipt');
                //     $('.payment-screen').addClass('hide_receipt');
                //     $('.product-list-scroller').addClass('oe_hidden');
                //     $('.buttons_pane').animate({width: '0px'}, 'fast');
                //     $('.pos .rightpane').animate({left: '440px'}, 'fast');
                //     self.gui.show_screen('products');
                //     $('.back_products_screen').click(function () {
                //         $(".pos .pad").css( {"pointer-events": "auto"});
                //         $(".pos .pads .numpad").css( {"pointer-events": "auto"});
                //         // $(".header-row").removeClass("oe_hidden");
                //         $(".orderline").css( {"pointer-events": "auto"});
                //         $(".pos .actionpad button").css( {"pointer-events": "auto"});
                //         $(".pos .actionpad span").css( {"pointer-events": "auto"});
                //         $('.product-list-scroller').removeClass('oe_hidden');
                //         $('.screen').removeClass('hide_receipt');
                //         $('.payment-screen').removeClass('hide_receipt');
                //         $('.buttons_pane').animate({width: '170px'}, 'fast');
                //         $('.pos .rightpane').animate({left: '740px'}, 'fast');
                //         self.pos.gui.screen_instances['products'].rerender_products_screen(self.pos.gui.chrome.widget["products_view_widget"].view_type);
                //         $('.payment-screen-container').addClass('oe_hidden');
                //         payment_screen.hide();
                //     })
                // }
            });
            // TODO: quickly select partner
            this.$('.set-customer').click(function () {
                var quickly_search_client = self.pos.config.quickly_search_client;
                if (quickly_search_client) {
                    self.gui.show_screen('products');
                    self.pos.gui.show_popup('popup_selection_extend', {
                        title: 'Select Customer',
                        fields: ['name', 'email', 'phone', 'mobile'],
                        sub_datas: self.pos.db.get_partners_sorted(5),
                        sub_search_string: self.pos.db.partner_search_string,
                        sub_record_by_id: self.pos.db.partner_by_id,
                        sub_template: 'clients_list',
                        sub_button: '<div class="btn btn-success pull-right go_clients_screen">Go Clients Screen</div>',
                        sub_button_action: function () {
                            self.pos.gui.show_screen('clientlist')
                        },
                        body: 'Please select one client',
                        confirm: function (client_id) {
                            var client = self.pos.db.get_partner_by_id(client_id);
                            if (client) {
                                self.gui.screen_instances["clientlist"]['new_client'] = client;
                                self.pos.trigger('client:save_changes');
                            }
                        }
                    })
                }
            });
        }
    });

    var ReviewReceiptScreen = screens.ScreenWidget.extend({
        template: 'ReviewReceiptScreen',
        show: function () {
            this._super();
            this.render_change();
            this.render_receipt();
            this.handle_auto_print();
            this.auto_print_network();  // TODO: supported module pos_retail_network_printer
        },
        auto_print_network: function () {
            if (this.pos.epson_printer_default) {
                var odoo_version = this.pos.server_version;
                var env;
                var receipt;
                if (odoo_version == 10)
                    env = this.pos.gui.screen_instances['receipt'].get_receipt_data();
                else
                    env = this.pos.gui.screen_instances['receipt'].get_receipt_render_env();
                if (this.pos.config.receipt_without_payment_template == 'display_price') {
                    receipt = qweb.render('XmlReceipt', env);
                } else {
                    receipt = qweb.render('XmlReceiptNoPrice', env);
                }
                this.pos.print_network(receipt, this.pos.epson_printer_default['ip']);
            }
        },
        handle_auto_print: function () {
            if (this.should_auto_print()) {
                this.print();
            }
        },
        should_auto_print: function () {
            return this.pos.config.iface_print_auto;
        },
        should_close_immediately: function () {
            return this.pos.config.iface_print_via_proxy && this.pos.config.iface_print_skip_screen;
        },
        lock_screen: function (locked) {
            this._locked = locked;
            if (locked) {
                this.$('.back').removeClass('highlight');
            } else {
                this.$('.back').addClass('highlight');
            }
        },
        get_receipt_render_env: function () {
            var order = this.pos.get_order();
            return {
                widget: this,
                pos: this.pos,
                order: order,
                receipt: order.export_for_printing(),
                orderlines: order.get_orderlines(),
                paymentlines: order.get_paymentlines(),
            };
        },
        print_web: function () {
            window.print();
            this.pos.get_order()._printed = true;
        },
        print_xml: function () {
            var env;
            var receipt;
            var odoo_version = this.pos.server_version;
            if (odoo_version == 10)
                env = this.pos.gui.screen_instances['receipt'].get_receipt_data();
            else
                env = this.pos.gui.screen_instances['receipt'].get_receipt_render_env();
            if (this.pos.config.receipt_without_payment_template == 'display_price') {
                receipt = qweb.render('XmlReceipt', env);
            } else {
                receipt = qweb.render('XmlReceiptNoPrice', env);
            }
            this.pos.proxy.print_receipt(receipt);
            this.pos.get_order()._printed = true;
        },
        print: function () {
            if (this.pos.config.iface_print_via_proxy) {
                this.print_xml();
                this.lock_screen(false);
            } else {
                this.print_web();
            }
            this.auto_print_network()
        },
        click_back: function () {
            this.pos.gui.show_screen('products')
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back').click(function () {
                if (!self._locked) {
                    self.click_back();
                }
                self.pos.trigger('back:order');
            });
            this.$('.button.print').click(function () {
                if (!self._locked) {
                    self.print();
                }
            });
        },
        render_change: function () {
            this.$('.change-value').html(this.format_currency(this.pos.get_order().get_change()));
        },
        render_receipt: function () {
            var datas = {};
            if (this.pos.server_version != 10) {
                datas = this.pos.gui.screen_instances['receipt'].get_receipt_render_env()
            } else {
                datas = this.pos.gui.screen_instances['receipt'].get_receipt_data()
            }
            this.$('.pos-receipt-container').html(qweb.render('PosTicket', datas));
            try {
                var order = this.pos.get_order();
                if (order && order['ean13']) {
                    this.$('img[id="barcode"]').removeClass('oe_hidden');
                    JsBarcode("#barcode", order['ean13'], {
                        format: "EAN13",
                        displayValue: true,
                        fontSize: 18
                    });
                }
                if (order.index_number_order) {
                    this.$('img[id="barcode_order_unique"]').removeClass('oe_hidden');
                    JsBarcode("#barcode_order_unique", order['index_number_order'], {
                        format: "EAN13",
                        displayValue: true,
                        fontSize: 18
                    });
                }
            } catch (error) {
                console.error(error)
            }
        }
    });

    gui.define_screen({name: 'review_receipt', widget: ReviewReceiptScreen});

    return {
        'ReviewReceiptScreen': ReviewReceiptScreen
    }
});
