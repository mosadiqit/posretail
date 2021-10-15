"use strict";
odoo.define('pos_retail.promotion', function (require) {
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var qweb = core.qweb;
    var gui = require('point_of_sale.gui');
    var PopupWidget = require('point_of_sale.popups');

    var exports = {};
    var Backbone = window.Backbone;
    var bus = require('pos_retail.core_bus');
    var time = require('web.time');

    models.load_models([
        {
            model: 'pos.promotion',
            fields: [
                'name',
                'start_date',
                'end_date',
                'type',
                'product_id',
                'discount_lowest_price',
                'product_ids',
                'minimum_items',
                'discount_first_order',
                'special_customer_ids',
                'promotion_birthday',
                'promotion_birthday_type',
                'promotion_group',
                'promotion_group_ids',
            ],
            domain: function (self) {
                return [
                    ['state', '=', 'active'],
                    ['start_date', '<=', time.date_to_str(new Date()) + " " + time.time_to_str(new Date())],
                    ['end_date', '>=', time.date_to_str(new Date()) + " " + time.time_to_str(new Date())],
                    ['id', 'in', self.config.promotion_ids]
                ]
            },
            promotion: true,
            loaded: function (self, promotions) {
                var promotion_applied = [];
                promotions.forEach(function (promotion) {
                    if (self.config.promotion_ids.indexOf(promotion['id']) >= 0) {
                        promotion_applied.push(promotion);
                    }
                });
                self.promotions = promotion_applied;
                self.promotion_by_id = {};
                self.promotion_ids = [];
                var i = 0;
                while (i < promotions.length) {
                    self.promotion_by_id[promotions[i].id] = promotions[i];
                    self.promotion_ids.push(promotions[i].id);
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.order',
            fields: ['minimum_amount', 'discount', 'promotion_id'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, discounts) {
                self.promotion_discount_order_by_id = {};
                self.promotion_discount_order_by_promotion_id = {};
                var i = 0;
                while (i < discounts.length) {
                    self.promotion_discount_order_by_id[discounts[i].id] = discounts[i];
                    if (!self.promotion_discount_order_by_promotion_id[discounts[i].promotion_id[0]]) {
                        self.promotion_discount_order_by_promotion_id[discounts[i].promotion_id[0]] = [discounts[i]]
                    } else {
                        self.promotion_discount_order_by_promotion_id[discounts[i].promotion_id[0]].push(discounts[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.category',
            fields: ['category_id', 'discount', 'promotion_id'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, discounts_category) {
                self.promotion_by_category_id = {};
                var i = 0;
                while (i < discounts_category.length) {
                    self.promotion_by_category_id[discounts_category[i].category_id[0]] = discounts_category[i];
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.quantity',
            fields: ['product_id', 'quantity', 'discount', 'promotion_id'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, discounts_quantity) {
                self.promotion_quantity_by_product_id = {};
                var i = 0;
                while (i < discounts_quantity.length) {
                    if (!self.promotion_quantity_by_product_id[discounts_quantity[i].product_id[0]]) {
                        self.promotion_quantity_by_product_id[discounts_quantity[i].product_id[0]] = [discounts_quantity[i]]
                    } else {
                        self.promotion_quantity_by_product_id[discounts_quantity[i].product_id[0]].push(discounts_quantity[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.gift.condition',
            fields: ['product_id', 'minimum_quantity', 'promotion_id'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, gift_conditions) {
                self.promotion_gift_condition_by_promotion_id = {};
                var i = 0;
                while (i < gift_conditions.length) {
                    if (!self.promotion_gift_condition_by_promotion_id[gift_conditions[i].promotion_id[0]]) {
                        self.promotion_gift_condition_by_promotion_id[gift_conditions[i].promotion_id[0]] = [gift_conditions[i]]
                    } else {
                        self.promotion_gift_condition_by_promotion_id[gift_conditions[i].promotion_id[0]].push(gift_conditions[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.gift.free',
            fields: ['product_id', 'quantity_free', 'promotion_id', 'type'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, gifts_free) {
                self.promotion_gift_free_by_promotion_id = {};
                var i = 0;
                while (i < gifts_free.length) {
                    if (!self.promotion_gift_free_by_promotion_id[gifts_free[i].promotion_id[0]]) {
                        self.promotion_gift_free_by_promotion_id[gifts_free[i].promotion_id[0]] = [gifts_free[i]]
                    } else {
                        self.promotion_gift_free_by_promotion_id[gifts_free[i].promotion_id[0]].push(gifts_free[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.condition',
            fields: ['product_id', 'minimum_quantity', 'promotion_id'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, discount_conditions) {
                self.promotion_discount_condition_by_promotion_id = {};
                var i = 0;
                while (i < discount_conditions.length) {
                    if (!self.promotion_discount_condition_by_promotion_id[discount_conditions[i].promotion_id[0]]) {
                        self.promotion_discount_condition_by_promotion_id[discount_conditions[i].promotion_id[0]] = [discount_conditions[i]]
                    } else {
                        self.promotion_discount_condition_by_promotion_id[discount_conditions[i].promotion_id[0]].push(discount_conditions[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.apply',
            fields: ['product_id', 'discount', 'promotion_id', 'type'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, discounts_apply) {
                self.promotion_discount_apply_by_promotion_id = {};
                var i = 0;
                while (i < discounts_apply.length) {
                    if (!self.promotion_discount_apply_by_promotion_id[discounts_apply[i].promotion_id[0]]) {
                        self.promotion_discount_apply_by_promotion_id[discounts_apply[i].promotion_id[0]] = [discounts_apply[i]]
                    } else {
                        self.promotion_discount_apply_by_promotion_id[discounts_apply[i].promotion_id[0]].push(discounts_apply[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.price',
            fields: ['product_id', 'minimum_quantity', 'price_down', 'promotion_id'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, prices) {
                self.promotion_price_by_promotion_id = {};
                var i = 0;
                while (i < prices.length) {
                    if (!self.promotion_price_by_promotion_id[prices[i].promotion_id[0]]) {
                        self.promotion_price_by_promotion_id[prices[i].promotion_id[0]] = [prices[i]]
                    } else {
                        self.promotion_price_by_promotion_id[prices[i].promotion_id[0]].push(prices[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.special.category',
            fields: ['category_id', 'type', 'count', 'discount', 'promotion_id', 'product_id', 'qty_free'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, promotion_lines) {
                self.promotion_special_category_by_promotion_id = {};
                var i = 0;
                while (i < promotion_lines.length) {
                    if (!self.promotion_special_category_by_promotion_id[promotion_lines[i].promotion_id[0]]) {
                        self.promotion_special_category_by_promotion_id[promotion_lines[i].promotion_id[0]] = [promotion_lines[i]]
                    } else {
                        self.promotion_special_category_by_promotion_id[promotion_lines[i].promotion_id[0]].push(promotion_lines[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.multi.buy',
            fields: ['promotion_id', 'product_id', 'list_price', 'qty_apply'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, multi_buy) {
                self.multi_buy = multi_buy;
                self.multi_buy_by_product_id = {};
                for (var i = 0; i < multi_buy.length; i++) {
                    var rule = multi_buy[i];
                    self.multi_buy_by_product_id[rule['product_id'][0]] = rule;
                }
            }
        }
    ], {after: 'pos.config'})
    exports.pos_sync_prmotions = Backbone.Model.extend({
        initialize: function (pos) {
            this.pos = pos;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.last = this.pos.db.load('bus_last', 0);
            this.bus.on("notification", this, this.on_notification);
            this.bus.start_polling();
        },
        on_notification: function (notifications) {
            if (notifications && notifications[0] && notifications[0][1]) {
                for (var i = 0; i < notifications.length; i++) {
                    var channel = notifications[i][0][1];
                    if (channel == 'pos.sync.promotions') {
                        var promotions_model = _.filter(this.pos.models, function (model) {
                            return model.promotion
                        });
                        if (promotions_model) {
                            for (var i = 0; i < promotions_model.length; i++) {
                                var model = promotions_model[i];
                                this.pos.load_server_data_by_model(model);
                            }
                        }
                    }
                }
            }
        }
    });

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        load_server_data: function () {
            var self = this;
            return _super_PosModel.load_server_data.apply(this, arguments).then(function () {
                self.pos_sync_prmotions = new exports.pos_sync_prmotions(self);
                self.pos_sync_prmotions.start();
                return true;
            })
        },
    });

    screens.PaymentScreenWidget.include({
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.button_remove_promotion').click(function () { // Signature on Order
                var order = self.pos.get_order();
                order.remove_all_promotion_line();
            });
            this.$('.button_promotion').click(function () { // Signature on Order
                var order = self.pos.get_order();
                order.remove_all_promotion_line();
                var promotion_manual_select = self.pos.config.promotion_manual_select;
                if (!promotion_manual_select) {
                    order.apply_promotion()
                } else {
                    var promotion_datas = order.get_promotions_active();
                    var promotions_active = promotion_datas['promotions_active'];
                    if (promotions_active.length) {
                        return self.pos.gui.show_popup('popup_selection_promotions', {
                            title: 'Promotion list',
                            body: 'Please choice promotions and confirm',
                            promotions_active: promotions_active
                        })
                    } else {
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Nothing promotions active',
                        })
                    }

                }
            });
        }
    });

    var _super_Orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        init_from_JSON: function (json) {
            var res = _super_Orderline.init_from_JSON.apply(this, arguments);
            if (json.promotion) {
                this.promotion = json.promotion;
            }
            if (json.promotion_reason) {
                this.promotion_reason = json.promotion_reason;
            }
            if (json.promotion_discount_total_order) {
                this.promotion_discount_total_order = json.promotion_discount_total_order;
            }
            if (json.promotion_discount_category) {
                this.promotion_discount_category = json.promotion_discount_category;
            }
            if (json.promotion_discount_by_quantity) {
                this.promotion_discount_by_quantity = json.promotion_discount_by_quantity;
            }
            if (json.promotion_gift) {
                this.promotion_gift = json.promotion_gift;
            }
            if (json.promotion_discount) {
                this.promotion_discount = json.promotion_discount;
            }
            if (json.promotion_price_by_quantity) {
                this.promotion_price_by_quantity = json.promotion_price_by_quantity;
            }
            return res;
        },
        export_as_JSON: function () {
            var json = _super_Orderline.export_as_JSON.apply(this, arguments);
            if (this.promotion) {
                json.promotion = this.promotion;
            }
            if (this.promotion_reason) {
                json.promotion_reason = this.promotion_reason;
            }
            if (this.promotion_discount_total_order) {
                json.promotion_discount_total_order = this.promotion_discount_total_order;
            }
            if (this.promotion_discount_category) {
                json.promotion_discount_category = this.promotion_discount_category;
            }
            if (this.promotion_discount_by_quantity) {
                json.promotion_discount_by_quantity = this.promotion_discount_by_quantity;
            }
            if (this.promotion_discount) {
                json.promotion_discount = this.promotion_discount;
            }
            if (this.promotion_gift) {
                json.promotion_gift = this.promotion_gift;
            }
            if (this.promotion_price_by_quantity) {
                json.promotion_price_by_quantity = this.promotion_price_by_quantity;
            }

            return json;
        },
        export_for_printing: function () {
            var receipt_line = _super_Orderline.export_for_printing.apply(this, arguments);
            receipt_line['promotion'] = null;
            receipt_line['promotion_reason'] = null;
            if (this.promotion) {
                receipt_line.promotion = this.promotion;
                receipt_line.promotion_reason = this.promotion_reason;
            }
            return receipt_line;
        },
        can_be_merged_with: function (orderline) {
            var merge = _super_Orderline.can_be_merged_with.apply(this, arguments);
            if (this.promotion) {
                return false;
            }
            return merge
        },
        set_quantity: function (quantity, keep_price) {
            _super_Orderline.set_quantity.apply(this, arguments);
            if (!this.promotion && quantity == 'remove' || quantity == '') {
                this.order.remove_all_promotion_line();
            }
        }
    });
    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        export_as_JSON: function () {
            var json = _super_Order.export_as_JSON.apply(this, arguments);
            if (this.promotion_amount) {
                json.promotion_amount = this.promotion_amount;
            }
            return json;
        },
        export_for_printing: function () {
            var receipt = _super_Order.export_for_printing.call(this);
            if (this.promotion_amount) {
                receipt.promotion_amount = this.promotion_amount;
            }
            return receipt
        },
        validate_promotion: function () {
            var self = this;
            var datas = this.get_promotions_active();
            var promotions_active = datas['promotions_active'];
            if (promotions_active.length) {
                if (!this.pos.config.promotion_auto_add) {
                    this.pos.gui.show_screen('products');
                    this.pos.gui.show_popup('confirm', {
                        title: 'Promotion active',
                        body: 'Do you want to apply promotion on this order ?',
                        confirm: function () {
                            self.remove_all_promotion_line();
                            self.apply_promotion();
                            setTimeout(function () {
                                self.validate_global_discount();
                            }, 1000);
                            self.pos.gui.show_screen('payment');
                        },
                        cancel: function () {
                            setTimeout(function () {
                                self.validate_global_discount();
                            }, 1000);
                            self.pos.gui.show_screen('payment');
                        }
                    });
                } else {
                    self.remove_all_promotion_line();
                    self.apply_promotion();
                }
            } else {
                setTimeout(function () {
                    self.validate_global_discount();
                }, 1000);
            }
        },
        get_amount_total_without_promotion: function () {
            var lines = this.orderlines.models;
            var amount_total = 0;
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (!line.promotion) {
                    if (this.pos.config.iface_tax_included === 'total') {
                        amount_total += line.get_price_with_tax();
                    } else {
                        amount_total += line.get_price_without_tax();
                    }
                }
            }
            return amount_total;
        },
        apply_promotion: function (promotions) {
            /*
                If not promotions send me, it mean automatic apply
                We will get all promotions active and set to order
             */
            if (this.is_return) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Return order not allow apply promotion',
                });
            }
            if (!promotions) {
                var promotions = this.get_promotions_active()['promotions_active'];
            }
            if (promotions) {
                this.remove_all_promotion_line();
                for (var i = 0; i < promotions.length; i++) {
                    var type = promotions[i].type
                    var order = this;
                    if (order.orderlines.length) {
                        if (type == '1_discount_total_order') {
                            order.compute_discount_total_order(promotions[i]);
                        }
                        if (type == '2_discount_category') {
                            order.compute_discount_category(promotions[i]);
                        }
                        if (type == '3_discount_by_quantity_of_product') {
                            order.compute_discount_by_quantity_of_products(promotions[i]);
                        }
                        if (type == '4_pack_discount') {
                            order.compute_pack_discount(promotions[i]);
                        }
                        if (type == '5_pack_free_gift') {
                            order.compute_pack_free_gift(promotions[i]);
                        }
                        if (type == '6_price_filter_quantity') {
                            order.compute_price_filter_quantity(promotions[i]);
                        }
                        if (type == '7_special_category') {
                            order.compute_special_category(promotions[i]);
                        }
                        if (type == '8_discount_lowest_price') {
                            order.compute_discount_lowest_price(promotions[i]);
                        }
                        if (type == '9_multi_buy') {
                            order.compute_multi_buy(promotions[i]);
                        }
                        if (type == '10_buy_x_get_another_free') {
                            order.compute_buy_x_get_another_free(promotions[i]);
                        }
                        if (type == '11_first_order') {
                            order.compute_first_order(promotions[i]);
                        }
                    }
                }
                var applied_promotion = false;
                var total_promotion_line = 0;
                for (var i = 0; i < this.orderlines.models.length; i++) {
                    if (this.orderlines.models[i]['promotion'] == true) {
                        applied_promotion = true;
                        total_promotion_line += 1;
                    }
                }
            }
        },
        remove_all_buyer_promotion_line: function () {
            var lines = this.orderlines.models;
            for (var n = 0; n < 2; n++) {
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    if (line['buyer_promotion']) {
                        this.orderlines.remove(line);
                    }
                }
            }
        },
        remove_all_promotion_line: function () {
            var lines = this.orderlines.models;
            var total_removed = 0
            for (var n = 0; n < 2; n++) {
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    if (line['promotion'] || line['promotion_discount_total_order'] || line['promotion_discount_category'] || line['promotion_discount_by_quantity'] || line['promotion_discount'] || line['promotion_gift'] || line['promotion_price_by_quantity']) {
                        this.orderlines.remove(line);
                        total_removed += 1
                    }
                }
            }
        },
        product_quantity_by_product_id: function () {
            var lines_list = {};
            var lines = this.orderlines.models;
            var i = 0;
            while (i < lines.length) {
                var line = lines[i];
                if (line.promotion) {
                    i++;
                    continue
                }
                if (!lines_list[line.product.id]) {
                    lines_list[line.product.id] = line.quantity;
                } else {
                    lines_list[line.product.id] += line.quantity;
                }
                i++;
            }
            return lines_list
        },
        total_price_by_product_id: function () {
            var total_price_by_product = {};
            for (var i = 0; i < this.orderlines.models.length; i++) {
                var line = this.orderlines.models[i];
                if (this.pos.config.iface_tax_included === 'total') {
                    if (!total_price_by_product[line.product.id]) {
                        total_price_by_product[line.product.id] = line.get_price_with_tax();
                    } else {
                        total_price_by_product[line.product.id] += line.get_price_with_tax();
                    }
                } else {
                    if (!total_price_by_product[line.product.id]) {
                        total_price_by_product[line.product.id] = line.get_price_without_tax();
                    } else {
                        total_price_by_product[line.product.id] += line.get_price_without_tax();
                    }
                }
            }
            return total_price_by_product;
        },
        checking_special_client: function (promotion) {
            /*
                Checking client selected have inside special customers of promotion
             */
            if (!promotion.special_customer_ids || promotion.special_customer_ids.length == 0) {
                return true
            } else {
                var order = this.pos.get_order();
                if (!order) {
                    return true
                } else {
                    var client = order.get_client();
                    if (!client && promotion.special_customer_ids.length) {
                        return false
                    } else {
                        var client_id = client.id;
                        if (promotion.special_customer_ids.indexOf(client_id) == -1) {
                            return false
                        } else {
                            return true
                        }
                    }
                }
            }
        },
        checking_promotion_birthday_match_birthdayof_client: function (promotion) {
            /*
                We checking 2 condition
                1. Promotion is promotion birthday
                2. Birthday of client isnide period time of promotion allow
             */
            if (!promotion.promotion_birthday) {
                return true
            } else {
                var client = this.get_client();
                var passed = false;
                if (client && client['birthday_date']) {
                    var birthday_date = moment(client['birthday_date']);
                    var today = moment(new Date());
                    if (promotion['promotion_birthday_type'] == 'day') {
                        if ((birthday_date.date() == today.date()) && (birthday_date.month() == today.month())) {
                            passed = true
                        }
                    }
                    if (promotion['promotion_birthday_type'] == 'week') {
                        var parts = client['birthday_date'].split('-');
                        var birthday_date = new Date(new Date().getFullYear() + '-' + parts[1] + '-' + parts[0]).getTime() + 86400000;
                        var startOfWeek = moment().startOf('week').toDate().getTime() + 86400000;
                        var endOfWeek = moment().endOf('week').toDate().getTime() + 86400000;
                        if (startOfWeek <= birthday_date && birthday_date <= endOfWeek) {
                            passed = true;
                        }
                    }
                    if (promotion['promotion_birthday_type'] == 'month') {
                        if (birthday_date.month() == today.month()) {
                            passed = true
                        }
                    }
                }
                return passed;
            }
        },
        checking_prmotion_has_groups: function (promotion) {
            /*
                We checking 2 condition
                1. Promotion is promotion birthday
                2. Birthday of client isnide period time of promotion allow
             */
            if (!promotion.promotion_group) {
                return true
            } else {
                var client = this.get_client();
                var passed = false;
                if (promotion.promotion_group_ids.length && client && client.group_ids) {
                    for (var i = 0; i < client.group_ids.length; i++) {
                        var group_id = client.group_ids[i];
                        if (promotion['promotion_group_ids'].indexOf(group_id) != -1) {
                            passed = true;
                            break;
                        }
                    }
                }
                return passed;
            }
        },
        order_has_promotion_applied: function () {
            var promotion_line = _.find(this.orderlines.models, function (line) {
                return line.promotion == true;
            });
            if (promotion_line) {
                return true
            } else {
                return false
            }
        },
        // 1) check current order can apply discount by total order
        checking_apply_total_order: function (promotion) {
            var can_apply = false;
            var discount_lines = this.pos.promotion_discount_order_by_promotion_id[promotion.id];
            var total_order = this.get_amount_total_without_promotion();
            var discount_line_tmp = null;
            var discount_tmp = 0;
            if (discount_lines) {
                var i = 0;
                while (i < discount_lines.length) {
                    var discount_line = discount_lines[i];
                    if (total_order >= discount_line.minimum_amount && total_order >= discount_tmp) {
                        discount_line_tmp = discount_line;
                        discount_tmp = discount_line.minimum_amount
                        can_apply = true
                    }
                    i++;
                }
            }
            return can_apply && this.checking_special_client(promotion);
        },
        // 2) check current order can apply discount by categories
        checking_can_discount_by_categories: function (promotion) {
            var can_apply = false;
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            if (!product || !this.pos.promotion_by_category_id) {
                return false;
            }
            for (var i in this.pos.promotion_by_category_id) {
                var promotion_line = this.pos.promotion_by_category_id[i];
                var amount_total_by_category = 0;
                var z = 0;
                var lines = this.orderlines.models;
                while (z < lines.length) {
                    if (!lines[z].product.pos_categ_id) {
                        z++;
                        continue;
                    }
                    if (lines[z].product.pos_categ_id[0] == promotion_line.category_id[0]) {
                        amount_total_by_category += lines[z].get_price_without_tax();
                    }
                    z++;
                }
                if (amount_total_by_category > 0) {
                    can_apply = true
                }
            }
            return can_apply && this.checking_special_client(promotion)
        },
        // 3) check condition for apply discount by quantity product
        checking_apply_discount_filter_by_quantity_of_product: function (promotion) {
            var can_apply = false;
            var rules = this.pos.promotion_quantity_by_product_id;
            var product_quantity_by_product_id = this.product_quantity_by_product_id();
            for (var product_id in product_quantity_by_product_id) {
                var rules_by_product_id = rules[product_id];
                if (rules_by_product_id) {
                    for (var i = 0; i < rules_by_product_id.length; i++) {
                        var rule = rules_by_product_id[i];
                        if (rule && rule['promotion_id'][0] == promotion['id'] && product_quantity_by_product_id[product_id] >= rule.quantity) {
                            can_apply = true;
                        }
                    }
                }
            }
            return can_apply && this.checking_special_client(promotion);
        },
        // 4. & 5. : check pack free gift and pack discount product
        checking_pack_discount_and_pack_free_gift: function (promotion, rules) {
            var can_apply = true;
            var product_quantity_by_product_id = this.product_quantity_by_product_id();
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                var product_id = rule.product_id[0];
                var minimum_quantity = rule.minimum_quantity;
                var total_qty_by_product = product_quantity_by_product_id[product_id];
                if ((total_qty_by_product && total_qty_by_product < minimum_quantity) || !total_qty_by_product) {
                    can_apply = false;
                }
            }
            return can_apply && this.checking_special_client(promotion)
        },
        // 6. check condition for apply price filter by quantity of product
        checking_apply_price_filter_by_quantity_of_product: function (promotion) {
            var condition = false;
            var rules = this.pos.promotion_price_by_promotion_id[promotion.id];
            var product_quantity_by_product_id = this.product_quantity_by_product_id();
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                if (rule && product_quantity_by_product_id[rule.product_id[0]] && product_quantity_by_product_id[rule.product_id[0]] >= rule.minimum_quantity) {
                    condition = true;
                }
            }
            return condition && this.checking_special_client(promotion);
        },
        // 7. checking promotion special category
        checking_apply_specical_category: function (promotion) {
            var condition = false;
            var promotion_lines = this.pos.promotion_special_category_by_promotion_id[promotion['id']];
            this.lines_by_category_id = {};
            for (var i = 0; i < this.orderlines.models.length; i++) {
                var line = this.orderlines.models[i];
                var pos_categ_id = line['product']['pos_categ_id'][0]
                if (pos_categ_id) {
                    if (!this.lines_by_category_id[pos_categ_id]) {
                        this.lines_by_category_id[pos_categ_id] = [line]
                    } else {
                        this.lines_by_category_id[pos_categ_id].push(line)
                    }
                }
            }
            for (var i = 0; i < promotion_lines.length; i++) {
                var promotion_line = promotion_lines[i];
                var categ_id = promotion_line['category_id'][0];
                var total_quantity = 0;

                if (this.lines_by_category_id[categ_id]) {
                    var total_quantity = 0;
                    for (var i = 0; i < this.lines_by_category_id[categ_id].length; i++) {
                        total_quantity += this.lines_by_category_id[categ_id][i]['quantity']
                    }
                    if (promotion_line['count'] <= total_quantity) {
                        condition = true;
                    }
                }
            }
            return condition && this.checking_special_client(promotion);
        },
        // 9. checking multi buy
        checking_multi_by: function (promotion) {
            var can_apply = false;
            var total_qty_by_product = this.product_quantity_by_product_id();
            for (var i = 0; i < this.orderlines.models.length; i++) {
                var line = this.orderlines.models[i];
                var product_id = line.product.id;
                var rule = this.pos.multi_buy_by_product_id[product_id];
                if (rule && rule['qty_apply'] <= total_qty_by_product[product_id]) {
                    can_apply = true;
                    break;
                }
            }
            return can_apply && this.checking_special_client(promotion);
        },
        // 10. by x (qty) get y (qty) free
        checking_buy_x_get_another_free: function (promotion) {
            var can_apply = false;
            var minimum_items = promotion['minimum_items'];
            var total_quantity = this.product_quantity_by_product_id();
            for (var index_id in promotion.product_ids) {
                var product_id = promotion.product_ids[index_id];
                if (total_quantity[product_id] && total_quantity[product_id] >= minimum_items) {
                    var product = this.pos.db.product_by_id[product_id];
                    if (product) {
                        can_apply = true;
                        break
                    }
                }
            }
            return can_apply && this.checking_special_client(promotion);
        },
        // 11. checking first order of customer
        checking_first_order_of_customer: function (promotion) {
            var order;
            if (this.get_client()) {
                var client = this.get_client();
                order = _.filter(this.pos.db.get_pos_orders(), function (order) {
                    return order.partner_id && order.partner_id[0] == client['id']
                });
                if (order.length == 0) {
                    return true && this.checking_special_client(promotion)
                } else {
                    return false && this.checking_special_client(promotion)
                }
            } else {
                return false && this.checking_special_client(promotion)
            }
        },
        compute_discount_total_order: function (promotion) { // 1. compute discount filter by total order
            /*
                1. Promotion discount by total order
            */
            var discount_lines = this.pos.promotion_discount_order_by_promotion_id[promotion.id];
            var total_order = this.get_amount_total_without_promotion();
            var discount_line_tmp = null;
            var discount_tmp = 0;
            if (discount_lines) {
                var i = 0;
                while (i < discount_lines.length) {
                    var discount_line = discount_lines[i];
                    if (total_order >= discount_line.minimum_amount && total_order >= discount_tmp) {
                        discount_line_tmp = discount_line;
                        discount_tmp = discount_line.minimum_amount;
                    }
                    i++;
                }
            }
            if (!discount_line_tmp) {
                return false;
            }
            var total_order = this.get_amount_total_without_promotion();
            if (discount_line_tmp && total_order > 0) {
                var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
                var price = -total_order / 100 * discount_line_tmp.discount
                if (product && price != 0) {
                    var options = {};
                    options.promotion_discount_total_order = true;
                    options.promotion = true;
                    options.promotion_reason = 'Discount ' + discount_line_tmp.discount + ' % ' + ' because total order bigger or equal ' + this.pos.gui.chrome.format_currency(discount_line_tmp.minimum_amount);
                    this.add_promotion_line(product, price, 1, options)
                }
            }
        },
        compute_discount_category: function (promotion) { // 2. compute discount filter by product categories
            /*
                2. Promotion discount by pos categories
            */
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            if (!product || !this.pos.promotion_by_category_id) {
                return false;
            }
            for (var i in this.pos.promotion_by_category_id) {
                var promotion_line = this.pos.promotion_by_category_id[i];
                var amount_total_by_category = 0;
                var lines = this.orderlines.models;
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    if (line.promotion || line.product.pos_categ_id[0] != promotion_line.category_id[0]) {
                        continue
                    } else {
                        if (this.pos.config.iface_tax_included === 'total') {
                            amount_total_by_category += line.get_price_with_tax() * (1 - line.get_discount() / 100)
                        } else {
                            amount_total_by_category += line.get_unit_price() * line.get_quantity() * (1 - line.get_discount() / 100)
                        }
                    }
                }
                if (amount_total_by_category != 0) {
                    var price = -amount_total_by_category / 100 * promotion_line.discount
                    this.add_promotion_line(product, price, 1, {
                        promotion_discount_category: true,
                        promotion: true,
                        promotion_reason: 'Discount ' + promotion_line.discount + ' % from category: ' + promotion_line.category_id[1],
                    })
                }
            }
        },
        compute_discount_by_quantity_of_products: function (promotion) {
            /*
                3. Promotion discount by quantities of product
            */
            var check = this.checking_apply_discount_filter_by_quantity_of_product(promotion)
            if (check == false) {
                return;
            }
            if (this.orderlines.models.length == 0) {
                return;
            }
            var quantity_by_product_id = {}
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            var i = 0;
            var lines = this.orderlines.models;
            while (i < lines.length) {
                var line = lines[i];
                if (!quantity_by_product_id[line.product.id]) {
                    quantity_by_product_id[line.product.id] = line.quantity;
                } else {
                    quantity_by_product_id[line.product.id] += line.quantity;
                }
                i++;
            }
            for (var product_id in quantity_by_product_id) {
                product_id = parseInt(product_id)
                var promotion_lines = this.pos.promotion_quantity_by_product_id[product_id];
                if (!promotion_lines) {
                    continue;
                }
                var quantity_tmp = 0;
                var promotion_line = null;
                var j = 0;
                for (var number_index_of_array in promotion_lines) {
                    var condition = quantity_tmp <= promotion_lines[number_index_of_array].quantity && quantity_by_product_id[product_id] >= promotion_lines[number_index_of_array].quantity;
                    if (condition && promotion_lines[number_index_of_array]['product_id'][0] == product_id && promotion_lines[number_index_of_array]['promotion_id'][0] == promotion['id']) {
                        promotion_line = promotion_lines[number_index_of_array];
                        quantity_tmp = promotion_lines[number_index_of_array].quantity
                    }
                }
                var lines = this.orderlines.models;
                var amount_total_by_product = 0;
                for (var x = 0; x < lines.length; x++) {
                    var line = lines[x];
                    if (line.promotion) {
                        continue
                    }
                    if (line.product.id == product_id && !line.promotion) {
                        if (this.pos.config.iface_tax_included === 'total') {
                            amount_total_by_product += line.get_price_with_tax() * (1 - line.get_discount() / 100)
                        } else {
                            amount_total_by_product += line.get_unit_price() * line.get_quantity() * (1 - line.get_discount() / 100)
                        }
                    }
                }
                if (amount_total_by_product != 0 && promotion_line) {
                    this.add_promotion_line(product, -amount_total_by_product / 100 * promotion_line.discount, 1, {
                        promotion_discount_by_quantity: true,
                        promotion: true,
                        promotion_reason: 'Discount ' + promotion_line.discount + ' % when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity,
                    })
                }
            }
        },
        compute_pack_discount: function (promotion) {
            /*
                4. Promotion discount by pack products
            */
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            var discount_items = this.pos.promotion_discount_apply_by_promotion_id[promotion.id]
            if (!discount_items) {
                return;
            }
            var i = 0;
            while (i < discount_items.length) {
                var discount_item = discount_items[i];
                var discount = 0;
                var total_qty = 0;
                var lines = _.filter(this.orderlines.models, function (line) {
                    return !line['is_return'] && !line['promotion']
                });
                for (var j = 0; j < lines.length; j++) {
                    var line = lines[j];
                    if (line.product.id == discount_item.product_id[0]) {
                        total_qty += line.quantity;
                        if (this.pos.config.iface_tax_included === 'total') {
                            discount += line.get_price_with_tax() * (1 - line.get_discount() / 100)
                        } else {
                            discount += line.get_unit_price() * line.get_quantity() * (1 - line.get_discount() / 100)
                        }
                    }
                }
                if (discount_item.type == 'one') {
                    discount = discount / total_qty;
                }
                if (product && discount != 0) {
                    this.add_promotion_line(product, -discount / 100 * discount_item.discount, 1, {
                        promotion: true,
                        promotion_discount: true,
                        promotion_reason: 'Discount ' + discount_item.discount + ' % ' + discount_item.product_id[1] + ', from promotion: ' + promotion['name']
                    })
                }
                i++;
            }
        },
        count_quantity_by_product: function (product) {
            /*
                Function return total qty filter by product of order
            */
            var qty = 0;
            for (var i = 0; i < this.orderlines.models.length; i++) {
                var line = this.orderlines.models[i];
                if (line.product['id'] == product['id']) {
                    qty += line['quantity'];
                }
            }
            return qty;
        },
        compute_pack_free_gift: function (promotion) {
            /*
                5. Promotion free gift by pack products
            */
            var gifts = this.pos.promotion_gift_free_by_promotion_id[promotion.id];
            if (!gifts) {
                return;
            }
            var promotion_condition_items = this.pos.promotion_gift_condition_by_promotion_id[promotion.id];
            var products_condition = {};
            for (var i = 0; i < promotion_condition_items.length; i++) {
                var condition = promotion_condition_items[i];
                var product = this.pos.db.get_product_by_id(condition.product_id[0]);
                products_condition[product['id']] = this.count_quantity_by_product(product)
            }
            var can_continue = true;
            var temp = 1;
            for (var i = 1; i < 100; i++) {
                for (var j = 0; j < promotion_condition_items.length; j++) {
                    var condition = promotion_condition_items[j];
                    var condition_qty = condition.minimum_quantity;
                    var product = this.pos.db.get_product_by_id(condition.product_id[0]);
                    var total_qty = this.count_quantity_by_product(product);
                    if (i * condition_qty <= total_qty) {
                        can_continue = true;
                    } else {
                        can_continue = false
                    }
                }
                if (can_continue == true) {
                    temp = i;
                } else {
                    break;
                }
            }
            var i = 0;
            while (i < gifts.length) {
                var gift = gifts[i];
                var product = this.pos.db.get_product_by_id(gifts[i].product_id[0]);
                if (product) {
                    var qty_free = gift.quantity_free;
                    if (gift['type'] !== 'only_one') {
                        qty_free = qty_free * temp
                    }
                    this.add_promotion_line(product, 0, qty_free, {
                        promotion: true,
                        promotion_gift: true,
                        promotion_reason: 'Free ' + qty_free + ' ' + product['display_name'] + ' from promotion: ' + promotion['name']
                    })
                }
                i++;
            }
        },
        compute_price_filter_quantity: function (promotion) {
            /*
                6. Promotion set price filter by quantities of product
                Sale off each products
            */
            var promotion_prices = this.pos.promotion_price_by_promotion_id[promotion.id];
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            var lines = this.orderlines.models;
            if (promotion_prices) {
                var prices_item_by_product_id = {};
                for (var i = 0; i < promotion_prices.length; i++) {
                    var item = promotion_prices[i];
                    if (!prices_item_by_product_id[item.product_id[0]]) {
                        prices_item_by_product_id[item.product_id[0]] = [item]
                    } else {
                        prices_item_by_product_id[item.product_id[0]].push(item)
                    }
                }
                var quantity_by_product_id = this.product_quantity_by_product_id();
                for (i in quantity_by_product_id) {
                    var price_discount = 0;
                    if (prices_item_by_product_id[i]) {
                        var quantity_tmp = 0;
                        var price_item_tmp = null;
                        // root: quantity line, we'll compare this with 2 variable quantity line bigger minimum quantity of item and bigger quantity temp
                        for (var j = 0; j < prices_item_by_product_id[i].length; j++) {
                            var price_item = prices_item_by_product_id[i][j];
                            if (quantity_by_product_id[i] >= price_item.minimum_quantity && quantity_by_product_id[i] >= quantity_tmp) {
                                quantity_tmp = price_item.minimum_quantity;
                                price_item_tmp = price_item;
                            }
                        }
                        if (price_item_tmp) {
                            var price_discount = 0;
                            for (var j = 0; j < lines.length; j++) {
                                var line = lines[j];
                                if (line.quantity <= 0) {
                                    continue;
                                }
                                if (line.product.id == price_item_tmp.product_id[0]) {
                                    price_discount += line.quantity * price_item_tmp['price_down'];
                                }
                            }
                            if (price_discount != 0) {
                                this.add_promotion_line(product, price_discount, -1, {
                                    promotion: true,
                                    promotion_price_by_quantity: true,
                                    promotion_reason: 'By bigger or equal ' + price_item_tmp.minimum_quantity + ' ' + price_item_tmp.product_id[1] + ' price down  ' + this.pos.gui.chrome.format_currency(price_item_tmp['price_down']) + ' / unit.'
                                })
                            }
                        }
                    }
                }
            }
        },
        compute_special_category: function (promotion) {
            /*
                7. Promotion filter by special category
            */
            var product_service = this.pos.db.product_by_id[promotion['product_id'][0]];
            var promotion_lines = this.pos.promotion_special_category_by_promotion_id[promotion['id']];
            this.lines_by_category_id = {};
            for (var i = 0; i < this.orderlines.models.length; i++) {
                var line = this.orderlines.models[i];
                if (line.promotion) {
                    continue;
                }
                var pos_categ_id = line['product']['pos_categ_id'][0]
                if (pos_categ_id) {
                    if (!this.lines_by_category_id[pos_categ_id]) {
                        this.lines_by_category_id[pos_categ_id] = [line]
                    } else {
                        this.lines_by_category_id[pos_categ_id].push(line)
                    }
                }
            }
            for (var i = 0; i < promotion_lines.length; i++) {
                var promotion_line = promotion_lines[i];
                var categ_id = promotion_line['category_id'][0];
                if (this.lines_by_category_id[categ_id]) {
                    var total_quantity = 0;
                    for (var i = 0; i < this.lines_by_category_id[categ_id].length; i++) {
                        total_quantity += this.lines_by_category_id[categ_id][i]['quantity']
                    }
                    if (promotion_line['count'] <= total_quantity) {
                        var promotion_type = promotion_line['type'];
                        if (promotion_type == 'discount') {
                            var discount = 0;
                            var quantity = 0;
                            var lines = this.lines_by_category_id[categ_id];
                            for (var j = 0; j < lines.length; j++) {
                                quantity += lines[j]['quantity'];
                                var line = lines[j];
                                if (quantity >= promotion_line['count']) {
                                    if (this.pos.config.iface_tax_included === 'total') {
                                        discount += line.get_price_with_tax() / 100 / line['quantity'] * promotion_line['discount']
                                    } else {
                                        discount += line.get_price_without_tax() / 100 / line['quantity'] * promotion_line['discount']
                                    }
                                }
                            }
                            if (discount != 0) {
                                this.add_promotion_line(product_service, -discount, 1, {
                                    promotion: true,
                                    promotion_special_category: true,
                                    promotion_reason: promotion['name'] + ',Buy bigger than or equal ' + promotion_line['count'] + ' product of ' + promotion_line['category_id'][1] + ' discount ' + promotion_line['discount'] + ' %'
                                })
                            }
                        }
                        if (promotion_type == 'free') {
                            var product_free = this.pos.db.product_by_id[promotion_line['product_id'][0]];
                            if (product_free) {
                                this.add_promotion_line(product_free, 0, promotion_line['qty_free'], {
                                    promotion: true,
                                    promotion_special_category: true,
                                    promotion_reason: 'Buy bigger than or equal ' + promotion_line['count'] + ' product of ' + promotion_line['category_id'][1] + ' free ' + promotion_line['qty_free'] + ' ' + product_free['display_name']
                                })
                            }
                        }
                    }
                }
            }
        },
        compute_discount_lowest_price: function (promotion) { // compute discount lowest price
            /*
                8. discount lowest price of item
            */
            var orderlines = this.orderlines.models;
            var line_apply = null;
            for (var i = 0; i < orderlines.length; i++) {
                var line = orderlines[i];
                if (!line_apply) {
                    line_apply = line
                } else {
                    if (line.get_price_with_tax() < line_apply.get_price_with_tax()) {
                        line_apply = line;
                    }
                }
            }
            var product_discount = this.pos.db.product_by_id[promotion.product_id[0]];
            if (line_apply && product_discount) {
                var price;
                if (this.pos.config.iface_tax_included === 'total') {
                    price = line_apply.get_price_with_tax()
                } else {
                    price = line_apply.get_price_without_tax()
                }
                price = price / 100 * promotion['discount_lowest_price'];
                this.add_promotion_line(product_discount, price, -1, {
                    promotion: true,
                    promotion_discount_lowest_price: true,
                    promotion_reason: 'Discount ' + promotion['discount_lowest_price'] + ' (%) ' + line_apply.product.display_name + ' because lowest price of cart items'
                })
            }
        },
        compute_multi_buy: function (promotion) {
            /*
               9. Multi buy
            */
            var rule_applied = {};
            var total_qty_by_product = this.product_quantity_by_product_id();
            var total_price_by_product = this.total_price_by_product_id();
            var product_discount = this.pos.db.product_by_id[promotion.product_id[0]];
            for (var i = 0; i < this.orderlines.models.length; i++) {
                var line = this.orderlines.models[i];
                var product_id = line.product.id;
                var rule = this.pos.multi_buy_by_product_id[product_id];
                if (rule && rule['promotion_id'][0] == promotion['id']) {
                    rule_applied[rule['product_id'][0]] = rule;
                }
            }
            if (rule_applied && product_discount) {
                var price_discount = 0;
                for (var product_id in rule_applied) {
                    if (!rule_applied[product_id]) {
                        continue
                    }
                    var product = this.pos.db.get_product_by_id(product_id);
                    if (!product) {
                        continue
                    }
                    var total_qty = total_qty_by_product[product_id];
                    if (!total_qty) {
                        continue
                    }
                    var total_amount = total_price_by_product[product_id];
                    if (!total_amount) {
                        continue
                    }
                    var price_discount;
                    var promotion_reason;
                    var qty_apply = rule_applied[product_id]['qty_apply'];
                    if (total_qty >= qty_apply) {
                        var total_price_promotion_applied = (total_qty - qty_apply) * product['list_price'] + qty_apply * rule_applied[product_id]['list_price'];
                        var price_discount = total_amount - total_price_promotion_applied;
                        promotion_reason = product['display_name'] + ': buy ' + (total_qty - qty_apply) + ' with price: ' + this.pos.gui.chrome.format_currency(product['list_price']) + '. And ' + qty_apply + ' with price ' + this.pos.gui.chrome.format_currency(rule_applied[product_id]['list_price']);
                        if (price_discount < 0) {
                            price_discount = -price_discount
                        }
                        this.add_promotion_line(product_discount, price_discount, -1, {
                            promotion: true,
                            promotion_multi_buy: true,
                            promotion_reason: promotion_reason
                        })
                    }
                }
            }
        },
        compute_buy_x_get_another_free: function (promotion) {
            /*
                10. buy x get another free
             */
            var minimum_items = promotion['minimum_items'];
            if (minimum_items <= 0) {
                return this.pos.gui.show_popup('confirm', {
                    title: 'Error',
                    body: 'Promotion ' + promotion['name'] + ' have minimum items smaller than 0. Please set bigger than 0'
                })
            }
            var total_quantity = this.product_quantity_by_product_id();
            for (var index_id in promotion.product_ids) {
                var product_id = promotion.product_ids[index_id];
                if (total_quantity[product_id] && total_quantity[product_id] >= minimum_items) {
                    var qty_free = round_pr((total_quantity[product_id] / minimum_items), 0);
                    var product = this.pos.db.product_by_id[product_id];
                    if (!product) {
                        return this.pos.gui.show_popup('confirm', {
                            title: 'Error',
                            body: 'Product id ' + product_id + ' not available in pos'
                        })
                    }
                    this.add_promotion_line(product, 0, -qty_free, {
                        promotion: true,
                        promotion_multi_buy: true,
                        promotion_reason: 'Buy ' + total_quantity[product_id] + ' ' + product['display_name'] + ' free ' + qty_free
                    })
                }
            }
        },
        compute_first_order: function (promotion) {
            /*
                11. Promotion first order
            */
            var total_order = this.get_amount_total_without_promotion();
            if (total_order > 0 && promotion['discount_first_order']) {
                var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
                var price = -total_order / 100 * promotion.discount_first_order;
                if (product && price != 0) {
                    var options = {};
                    options.promotion_discount_total_order = true;
                    options.promotion = true;
                    options.promotion_reason = 'First order discount: ' + promotion.discount_first_order + ' % of total amount: ' + this.pos.gui.chrome.format_currency(total_order);
                    return this.add_promotion_line(product, price, 1, options);
                }
            }
        },
        add_promotion_line: function (product, price, quantity, options) {
            /*
                We add prmotion line to order selected by cashiers
             */
            var line = new models.Orderline({}, {pos: this.pos, order: this.pos.get_order(), product: product});
            if (options.promotion) {
                line.promotion = options.promotion;
            }
            if (options.buyer_promotion) {
                line.promotion = options.buyer_promotion;
            }
            if (options.frequent_buyer_id) {
                line.frequent_buyer_id = options.frequent_buyer_id;
            }
            if (options.promotion_reason) {
                line.promotion_reason = options.promotion_reason;
            }
            if (options.promotion_discount_total_order) {
                line.promotion_discount_total_order = options.promotion_discount_total_order;
            }
            if (options.promotion_discount_category) {
                line.promotion_discount_category = options.promotion_discount_category;
            }
            if (options.promotion_discount_by_quantity) {
                line.promotion_discount_by_quantity = options.promotion_discount_by_quantity;
            }
            if (options.promotion_discount) {
                line.promotion_discount = options.promotion_discount;
            }
            if (options.promotion_gift) {
                line.promotion_gift = options.promotion_gift;
            }
            if (options.promotion_price_by_quantity) {
                line.promotion_price_by_quantity = options.promotion_price_by_quantity;
            }
            if (options.promotion_special_category) {
                line.promotion_special_category = options.promotion_special_category;
            }
            if (options.promotion_discount_lowest_price) {
                line.promotion_discount_lowest_price = options.promotion_discount_lowest_price;
            }
            line.price_manually_set = true; //no need pricelist change, price of promotion change the same, i blocked
            line.set_quantity(quantity);
            line.set_unit_price(price);
            line.price_manually_set = true;
            this.orderlines.add(line);
            this.trigger('change', this);
        },
        get_promotions_active: function () {
            var can_apply = null;
            var promotions_active = [];
            if (!this.pos.promotions) {
                return {
                    can_apply: can_apply,
                    promotions_active: []
                };
            }
            for (var i = 0; i < this.pos.promotions.length; i++) {
                var promotion = this.pos.promotions[i];
                var is_special_customer = this.checking_special_client(promotion);
                var is_birthday_customer = this.checking_promotion_birthday_match_birthdayof_client(promotion);
                var is_mem_of_promotion_group = this.checking_prmotion_has_groups(promotion);
                if (promotion['type'] == '1_discount_total_order' && this.checking_apply_total_order(promotion) && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    can_apply = true;
                    promotions_active.push(promotion);
                } else if (promotion['type'] == '2_discount_category' && this.checking_can_discount_by_categories(promotion) && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    can_apply = true;
                    promotions_active.push(promotion);
                } else if (promotion['type'] == '3_discount_by_quantity_of_product' && this.checking_apply_discount_filter_by_quantity_of_product(promotion) && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    can_apply = true;
                    promotions_active.push(promotion);
                } else if (promotion['type'] == '4_pack_discount' && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    var promotion_condition_items = this.pos.promotion_discount_condition_by_promotion_id[promotion.id];
                    var checking_pack_discount_and_pack_free = this.checking_pack_discount_and_pack_free_gift(promotion, promotion_condition_items);
                    if (checking_pack_discount_and_pack_free) {
                        can_apply = true;
                        promotions_active.push(promotion);
                    }
                } else if (promotion['type'] == '5_pack_free_gift' && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    var promotion_condition_items = this.pos.promotion_gift_condition_by_promotion_id[promotion.id];
                    var checking_pack_discount_and_pack_free = this.checking_pack_discount_and_pack_free_gift(promotion, promotion_condition_items);
                    if (checking_pack_discount_and_pack_free) {
                        can_apply = checking_pack_discount_and_pack_free;
                        promotions_active.push(promotion);
                    }
                } else if (promotion['type'] == '6_price_filter_quantity' && this.checking_apply_price_filter_by_quantity_of_product(promotion) && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    can_apply = true;
                    promotions_active.push(promotion);
                } else if (promotion['type'] == '7_special_category' && this.checking_apply_specical_category(promotion) && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    can_apply = true;
                    promotions_active.push(promotion);
                } else if (promotion['type'] == '8_discount_lowest_price' && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    can_apply = true;
                    promotions_active.push(promotion);
                } else if (promotion['type'] == '9_multi_buy' && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    var check_multi_by = this.checking_multi_by(promotion);
                    if (check_multi_by) {
                        can_apply = check_multi_by;
                        promotions_active.push(promotion);
                    }
                } else if (promotion['type'] == '10_buy_x_get_another_free' && this.checking_special_client(promotion) && this.checking_promotion_birthday_match_birthdayof_client(promotion)) {
                    var check_by_x_get_another_free = this.checking_buy_x_get_another_free(promotion);
                    if (check_by_x_get_another_free) {
                        can_apply = check_by_x_get_another_free;
                        promotions_active.push(promotion);
                    }
                } else if (promotion['type'] == '11_first_order' && this.checking_special_client(promotion) && this.checking_promotion_birthday_match_birthdayof_client(promotion)) {
                    var can_apply_promotion = this.checking_first_order_of_customer(promotion);
                    if (can_apply_promotion) {
                        can_apply = can_apply_promotion;
                        promotions_active.push(promotion);
                    }
                }
            }
            return {
                can_apply: can_apply,
                promotions_active: promotions_active
            };
        }
    });
    screens.OrderWidget.include({
        active_promotion: function (buttons, selected_order) {
            if (selected_order && selected_order.is_return && buttons && buttons.button_promotion) {
                return buttons.button_promotion.highlight(false);
            }
            if (selected_order.orderlines && selected_order.orderlines.length > 0) {
                var lines = selected_order.orderlines.models;
                var promotion_amount = 0;
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i]
                    if (line.promotion) {
                        promotion_amount += line.get_price_without_tax()
                    }
                }
                var promotion_datas = selected_order.get_promotions_active();
                var can_apply = promotion_datas['can_apply'];
                if (buttons && buttons.button_promotion) {
                    buttons.button_promotion.highlight(can_apply);
                }
                var promotions_active = promotion_datas['promotions_active'];
                if (promotions_active.length) {
                    var promotion_recommend_customer_html = qweb.render('promotion_recommend_customer', {
                        promotions: promotions_active
                    });
                    $('.promotion_recommend_customer').html(promotion_recommend_customer_html);
                } else {
                    $('.promotion_recommend_customer').html("");
                }
            } else {
                if (buttons && buttons.button_promotion) {
                    buttons.button_promotion.highlight(false);
                }
            }
        },
        promotion_added: function (buttons, selected_order) {
            var promotion_added = false;
            if (selected_order.orderlines && selected_order.orderlines.length > 0) {
                var lines = selected_order.orderlines.models;
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i]
                    if (line.promotion) {
                        promotion_added = true;
                        break
                    }
                }
                if (buttons && buttons.button_remove_promotion) {
                    buttons.button_remove_promotion.highlight(promotion_added);
                }
            } else {
                if (buttons && buttons.button_remove_promotion) {
                    buttons.button_remove_promotion.highlight(false);
                }
            }
            return promotion_added;
        },
        active_buyers_promotion: function (buttons, selected_order) {
            if (selected_order && selected_order.is_return && buttons && buttons.button_buyer_promotion) {
                return buttons.button_buyer_promotion.highlight(false);
            }
            if (buttons.button_buyer_promotion) {
                var check = false;
                if (selected_order.orderlines.length == 0) {
                    check = false;
                }
                var customer = selected_order.get_client();
                if (!customer) {
                    check = false;
                } else {
                    var buyers = this.pos.buyer_by_partner_id[customer.id];
                    if (buyers && buyers.length > 0) {
                        for (var i = 0; i < buyers.length; i++) {
                            var buyer = buyers[i];
                            var promotion_id = buyer['promotion_id'][0];
                            var promotion = this.pos.buyer_by_promotion_id[promotion_id];
                            if (promotion) {
                                var buyer_group_id = promotion['buyers_group'][0];
                                var buyer_group = this.pos.buyer_group_by_id[buyer_group_id];
                                if (buyer_group) {
                                    var product_ids = buyer_group['products_ids'];
                                    if (product_ids.length > 0) {
                                        var number_of_sales = buyer_group['number_of_sales'];
                                        var lines = _.filter(selected_order.orderlines.models, function (line) {
                                            return product_ids.indexOf(line.product.id) != -1
                                        });
                                        var products_add_promotion = {};
                                        for (var j = 0; j < lines.length; j++) {
                                            var line = lines[j];
                                            if (!products_add_promotion[line.product.id]) {
                                                var qty_total = selected_order.count_quantity_by_product(line.product);
                                                if (qty_total >= number_of_sales) {
                                                    check = true;
                                                }
                                            }
                                        }
                                    }
                                }

                            }
                        }
                    }
                }
                buttons.button_buyer_promotion.highlight(check);
            }
        },
        active_button_remove_promotions: function (buttons, selected_order) {
            if (!buttons.button_remove_promotion) {
                return;
            }
            var promotion_applied = selected_order.order_has_promotion_applied();
            if (promotion_applied && buttons && buttons.button_remove_promotion) {
                return buttons.button_remove_promotion.highlight(true);
            } else {
                return buttons.button_remove_promotion.highlight(false);
            }
        },
        update_summary: function () {
            this._super();
            var selected_order = this.pos.get_order();
            var buttons = this.getParent().action_buttons;
            if (selected_order && buttons) {
                this.active_promotion(buttons, selected_order);
                this.promotion_added(buttons, selected_order);
                this.active_buyers_promotion(buttons, selected_order);
                this.active_button_remove_promotions(buttons, selected_order)
            }
        }
    });

    var button_promotion = screens.ActionButtonWidget.extend({// promotion button
        template: 'button_promotion',
        button_click: function () {
            var order = this.pos.get('selectedOrder');
            var promotion_manual_select = this.pos.config.promotion_manual_select;
            if (!promotion_manual_select) {
                order.apply_promotion()
            } else {
                var promotion_datas = order.get_promotions_active();
                var promotions_active = promotion_datas['promotions_active'];
                if (promotions_active.length) {
                    return this.pos.gui.show_popup('popup_selection_promotions', {
                        title: 'Promotions',
                        body: 'Please choice promotions and confirm',
                        promotions_active: promotions_active
                    })
                } else {
                    return this.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Nothing promotions active',
                    })
                }

            }
        }
    });
    screens.define_action_button({
        'name': 'button_promotion',
        'widget': button_promotion,
        'condition': function () {
            return this.pos.promotion_ids && this.pos.promotion_ids.length >= 1;
        }
    });

    var button_remove_promotion = screens.ActionButtonWidget.extend({
        template: 'button_remove_promotion',
        button_click: function () {
            var order = this.pos.get('selectedOrder');
            if (order) {
                order.remove_all_promotion_line();
            }
        }
    });
    screens.define_action_button({
        'name': 'button_remove_promotion',
        'widget': button_remove_promotion,
        'condition': function () {
            return this.pos.promotion_ids && this.pos.promotion_ids.length >= 1;
        }
    });

    var popup_selection_promotions = PopupWidget.extend({ // add tags
        template: 'popup_selection_promotions',
        show: function (options) {
            var self = this;
            this._super(options);
            this.promotions_selected = {};
            var promotions = options.promotions_active;
            this.promotions = promotions;
            this.$el.find('.card-content').html(qweb.render('promotion_list', {
                promotions: promotions,
                widget: self
            }));
            this.$('.selection-item').click(function () {
                var promotion_id = parseInt($(this).data('id'));
                var promotion = self.pos.promotion_by_id[promotion_id];
                if (promotion) {
                    if ($(this).closest('.selection-item').hasClass("item-selected") == true) {
                        $(this).closest('.selection-item').toggleClass("item-selected");
                        delete self.promotions_selected[promotion.id];
                    } else {
                        $(this).closest('.selection-item').toggleClass("item-selected");
                        self.promotions_selected[promotion.id] = promotion;
                    }
                }
            });
            this.$('.cancel').click(function () {
                self.pos.gui.close_popup();
            });
            this.$('.confirm').click(function () {
                self.pos.gui.close_popup();
                var promotions = [];
                for (var i in self.promotions_selected) {
                    promotions.push(self.promotions_selected[i]);
                }
                if (promotions.length) {
                    self.pos.get_order().apply_promotion(promotions)
                } else {
                    self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Have not any promotions selected, please choice one'
                    })
                }
            });
            this.$('.add_all').click(function () {
                self.pos.get_order().apply_promotion(self.promotions);
                self.pos.gui.close_popup();
            });
        }
    });
    gui.define_popup({name: 'popup_selection_promotions', widget: popup_selection_promotions});

    var button_buyer_promotion = screens.ActionButtonWidget.extend({
        template: 'button_buyer_promotion',
        init: function (parent, options) {
            this._super(parent, options);
        },
        button_click: function () {
            var order = this.pos.get_order();
            if (!order) {
                return null
            }
            if (order.orderlines.length == 0) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Your order is blank'
                })
            }
            var customer = order.get_client();
            order.remove_all_buyer_promotion_line();
            if (!customer) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Please choice customer, customer of order is blank'
                })
            } else {
                var buyers = this.pos.buyer_by_partner_id[customer.id];
                if (buyers && buyers.length > 0) {
                    for (var i = 0; i < buyers.length; i++) {
                        var buyer = buyers[i];
                        var promotion_id = buyer['promotion_id'][0];
                        var promotion = this.pos.buyer_by_promotion_id[promotion_id];
                        if (promotion) {
                            var buyer_group_id = promotion['buyers_group'][0];
                            var buyer_group = this.pos.buyer_group_by_id[buyer_group_id];
                            if (buyer_group) {
                                var product_ids = buyer_group['products_ids'];
                                if (product_ids.length > 0) {
                                    var number_of_sales = buyer_group['number_of_sales'];
                                    var lines = _.filter(order.orderlines.models, function (line) {
                                        return product_ids.indexOf(line.product.id) != -1
                                    });
                                    var products_add_promotion = {};
                                    for (var j = 0; j < lines.length; j++) {
                                        var line = lines[j];
                                        if (!products_add_promotion[line.product.id]) {
                                            var qty_total = order.count_quantity_by_product(line.product);
                                            if (qty_total >= number_of_sales) {
                                                var qty_free = parseInt(qty_total / number_of_sales);
                                                var product_discount = this.pos.db.product_by_id[line.product.id];
                                                order.add_promotion_line(product_discount, 0, 1, {
                                                    'promotion': true,
                                                    'promotion_reason': 'By smaller than ' + number_of_sales + ' ' + line.product['display_name'] + ' free ' + qty_free,
                                                    'promotion_gift': true,
                                                    'frequent_buyer_id': buyer['id'],
                                                    'buyer_promotion': true
                                                });
                                                products_add_promotion[line.product.id] = line.product.id;
                                            }
                                        }
                                    }
                                }
                            } else {
                                return this.pos.gui.show_popup('dialog', {
                                    title: 'Warning',
                                    body: 'Could not find buyer group',
                                })
                            }

                        } else {
                            return this.pos.gui.show_popup('dialog', {
                                title: 'Warning',
                                body: 'Could not find promotion',
                            })
                        }
                    }
                } else {
                    return this.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Customer have not promotion',
                    })
                }
            }
        }
    });
    screens.define_action_button({
        'name': 'button_buyer_promotion',
        'widget': button_buyer_promotion,
        'condition': function () {
            return this.pos.buyers_promotion && this.pos.buyers_promotion.length;
        }
    });
    return exports
});
