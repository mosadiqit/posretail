"use strict";
odoo.define('pos_retail.loyalty', function (require) {

    var core = require('web.core');
    var _t = core._t;
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var RetailOrder = require('pos_retail.order');
    var time = require('web.time');

    models.load_models([
        {
            model: 'pos.loyalty',
            fields: ['name', 'product_loyalty_id', 'rounding', 'rounding_down'],
            condition: function (self) {
                return self.config.loyalty_id;
            },
            domain: function (self) {
                return [
                    ['id', '=', self.config.loyalty_id[0]],
                    ['state', '=', 'running'],
                ]
            },
            loaded: function (self, loyalties) {
                if (loyalties.length > 0) {
                    self.loyalty = loyalties[0];
                } else {
                    self.loyalty = false;
                }
            }
        }, {
            model: 'pos.loyalty.rule',
            fields: [
                'name',
                'loyalty_id',
                'coefficient',
                'type',
                'product_ids',
                'category_ids',
                'min_amount'
            ],
            condition: function (self) {
                return self.loyalty;
            },
            domain: function (self) {
                return [['loyalty_id', '=', self.loyalty.id], ['state', '=', 'running']];
            },
            loaded: function (self, rules) {
                self.rules = rules;
                self.rule_ids = [];
                self.rule_by_id = {};
                self.rules_by_loyalty_id = {};
                for (var i = 0; i < rules.length; i++) {
                    self.rule_by_id[rules[i].id] = rules[i];
                    self.rule_ids.push(rules[i].id)
                    if (!self.rules_by_loyalty_id[rules[i].loyalty_id[0]]) {
                        self.rules_by_loyalty_id[rules[i].loyalty_id[0]] = [rules[i]];
                    } else {
                        self.rules_by_loyalty_id[rules[i].loyalty_id[0]].push(rules[i]);
                    }
                }
            }
        }, {
            model: 'pos.loyalty.reward',
            fields: [
                'name',
                'loyalty_id',
                'redeem_point',
                'type',
                'coefficient',
                'discount',
                'discount_product_ids',
                'discount_category_ids',
                'min_amount',
                'gift_product_ids',
                'resale_product_ids',
                'gift_quantity',
                'price_resale'
            ],
            condition: function (self) {
                return self.loyalty;
            },
            domain: function (self) {
                return [['loyalty_id', '=', self.loyalty.id], ['state', '=', 'running']]
            },
            loaded: function (self, rewards) {
                self.rewards = rewards;
                self.reward_by_id = {};
                self.rewards_by_loyalty_id = {};
                for (var i = 0; i < rewards.length; i++) {
                    self.reward_by_id[rewards[i].id] = rewards[i];
                    if (!self.rewards_by_loyalty_id[rewards[i].loyalty_id[0]]) {
                        self.rewards_by_loyalty_id[rewards[i].loyalty_id[0]] = [rewards[i]];
                    } else {
                        self.rewards_by_loyalty_id[rewards[i].loyalty_id[0]].push([rewards[i]]);
                    }
                }
            }
        },
    ], {
        after: 'pos.config'
    });

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            var partner_model = this.get_model('res.partner');
            partner_model.fields.push(
                'pos_loyalty_point',
                'pos_loyalty_type'
            );
            return _super_PosModel.initialize.apply(this, arguments);
        },
        _save_to_server: function (orders, options) {
            var self = this;
            var res = _super_PosModel._save_to_server.call(this, orders, options);
            self.partner_need_update_ids = [];
            if (orders.length) {
                for (var n = 0; n < orders.length; n++) {
                    var order = orders[n]['data'];
                    if (order.partner_id) {
                        self.partner_need_update_ids.push(order.partner_id)
                    }
                }
            }
            res.done(function (order_ids) {
                if (self.partner_need_update_ids.length) {
                    for (var i = 0; i < self.partner_need_update_ids.length; i++) {
                        self.load_new_partners(self.partner_need_update_ids[i]);
                    }
                }
                self.partner_need_update_ids = [];
            });
            return res;
        },
    });

    var reward_button = screens.ActionButtonWidget.extend({
        template: 'reward_button',
        set_redeem_point: function (line, new_price, point) {
            line.redeem_point = round_pr(point, this.pos.loyalty.rounding);
            line.plus_point = 0;
            if (new_price != null) {
                line.price = new_price;
            }
            line.trigger_update_line();
            line.trigger('change', line);
            line.order.trigger('change', line.order)
        },
        button_click: function () {
            var list = [];
            var self = this;
            var order = self.pos.get('selectedOrder');
            var client = order.get_client();
            if (!client) {
                this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Please add client the first before choice reward program'
                });
                return this.pos.gui.show_screen('clientlist');
            }
            for (var i = 0; i < this.pos.rewards.length; i++) {
                var item = this.pos.rewards[i];
                list.push({
                    'label': item['name'],
                    'item': item
                });
            }
            if (list.length > 0) {
                this.gui.show_popup('selection', {
                    title: _t('Points of Client: ' + client['pos_loyalty_point']),
                    list: list,
                    confirm: function (reward) {
                        var loyalty = self.pos.loyalty;
                        if (!loyalty) {
                            return;
                        }
                        var product = self.pos.db.get_product_by_id(loyalty.product_loyalty_id[0]);
                        if (!product) {
                            return;
                        }
                        var order = self.pos.get('selectedOrder');
                        var applied = false;
                        var lines = order.orderlines.models;
                        if (lines.length == 0) {
                            return;
                        }
                        var total_with_tax = order.get_total_with_tax();
                        var redeem_point_used = order.build_redeem_point();
                        var client = order.get_client();
                        if (reward['min_amount'] > total_with_tax) {
                            return self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'Reward ' + reward['name'] + ' required min amount bigger than ' + reward['min_amount'],
                            })
                        }
                        if (client['pos_loyalty_point'] <= redeem_point_used) {
                            return self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'Point of customer not enough',
                            })
                        }
                        if ((reward['type'] == 'discount_products' || reward['type'] == 'discount_categories') && (reward['discount'] <= 0 || reward['discount'] > 100)) {
                            return self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'Reward discount required set discount bigger or equal 0 and smaller or equal 100'
                            })
                        }
                        if (reward['type'] == 'discount_products') {
                            var point_redeem = 0;
                            var amount_total = 0;
                            for (var i = 0; i < lines.length; i++) {
                                var line = lines[i];
                                if (reward['discount_product_ids'].indexOf(line['product']['id']) != -1) {
                                    amount_total += line.get_price_with_tax();
                                }
                            }
                            var point_will_redeem = amount_total * reward['discount'] / 100 / reward['coefficient'];
                            var price_discount = amount_total * reward['discount'] / 100;
                            if ((client['pos_loyalty_point'] > (point_will_redeem + redeem_point_used)) && price_discount) {
                                applied = true;
                                order.add_product(product, {
                                    price: price_discount,
                                    quantity: -1,
                                    merge: false,
                                    extras: {
                                        reward_id: reward.id,
                                        redeem_point: point_will_redeem
                                    }
                                });
                            }
                        } else if (reward['type'] == 'discount_categories') {
                            var point_redeem = 0;
                            var amount_total = 0;
                            for (var i = 0; i < lines.length; i++) {
                                var line = lines[i];
                                if (reward['discount_category_ids'].indexOf(line['product']['pos_categ_id'][0]) != -1) {
                                    amount_total += line.get_price_with_tax();
                                }
                            }
                            var point_will_redeem = amount_total * reward['discount'] / 100 / reward['coefficient'];
                            var price_discount = amount_total * reward['discount'] / 100;
                            if ((client['pos_loyalty_point'] > (point_will_redeem + redeem_point_used)) && price_discount) {
                                applied = true;
                                order.add_product(product, {
                                    price: price_discount,
                                    quantity: -1,
                                    merge: false,
                                    extras: {
                                        reward_id: reward.id,
                                        redeem_point: point_will_redeem
                                    }
                                });
                            }
                        } else if (reward['type'] == 'gift') {
                            for (var item_index in reward['gift_product_ids']) {
                                var product_gift = self.pos.db.get_product_by_id(reward['gift_product_ids'][item_index]);
                                if (product_gift) {
                                    var point_will_redeem = product_gift['list_price'] * reward['coefficient'];
                                    if (client['pos_loyalty_point'] > (point_will_redeem + redeem_point_used)) {
                                        applied = true;
                                        order.add_product(product_gift, {
                                            price: 0,
                                            quantity: reward['quantity'],
                                            merge: false,
                                            extras: {
                                                reward_id: reward.id,
                                                redeem_point: point_will_redeem
                                            }
                                        });
                                    }
                                }
                            }
                        } else if (reward['type'] == 'resale' && reward['price_resale'] > 0) {
                            var point_redeem = 0;
                            var amount_total = 0;
                            for (var i = 0; i < lines.length; i++) {
                                var line = lines[i];
                                if (reward['resale_product_ids'].indexOf(line['product']['id']) != -1) {
                                    amount_total += (line.get_price_with_tax() / line.quantity - reward['price_resale']) * line.quantity;
                                }
                            }
                            var point_will_redeem = amount_total * reward['coefficient'];
                            if (client['pos_loyalty_point'] > (point_will_redeem + redeem_point_used)) {
                                applied = true;
                                order.add_product(product, {
                                    price: amount_total,
                                    quantity: -1,
                                    merge: false,
                                    extras: {
                                        reward_id: reward.id,
                                        redeem_point: point_will_redeem
                                    }
                                });
                            }
                        } else if (reward['type'] == 'use_point_payment') {
                            var title = 1 / reward['coefficient'] + ' points = 1' + self.pos.currency['name'];
                            return self.gui.show_popup('number', {
                                'title': title,
                                'value': self.format_currency_no_symbol(0),
                                'confirm': function (point) {
                                    point = parseFloat(point);
                                    var redeem_point_used = order.build_redeem_point();
                                    var next_redeem_point = redeem_point_used + point;
                                    if (point <= 0) {
                                        return self.pos.gui.close_popup();
                                    }
                                    if (client['pos_loyalty_point'] < next_redeem_point) {
                                        return self.pos.gui.show_popup('dialog', {
                                            title: _t('Warning'),
                                            body: "Could not apply bigger than client's point " + client['pos_loyalty_point'],
                                        })

                                    } else {
                                        var loyalty = self.pos.loyalty;
                                        if (loyalty) {
                                            var next_amount = total_with_tax - (point * reward['coefficient']);
                                            if (next_amount >= 0) {
                                                applied = true;
                                                order.add_product(product, {
                                                    price: point * reward['coefficient'],
                                                    quantity: -1,
                                                    merge: false,
                                                    extras: {
                                                        reward_id: reward.id,
                                                        redeem_point: point
                                                    },
                                                });
                                            } else {
                                                return self.gui.show_popup('confirm', {
                                                    title: 'Warning',
                                                    body: 'Max point can add is ' + (total_with_tax / reward['coefficient']).toFixed(1),
                                                });
                                            }
                                        }
                                    }
                                }
                            });
                        }
                        if (applied) {
                            order.trigger('change', order);
                            return self.gui.show_popup('dialog', {
                                title: 'Succeed',
                                body: 'Order applied reward succeed',
                                color: 'info',
                            });
                        } else {
                            return self.gui.show_popup('dialog', {
                                title: 'Warning',
                                body: 'Client point have point smaller than reward point need',
                            });
                        }
                    }
                });
            } else {
                return this.gui.show_popup('dialog', {
                    title: 'ERROR',
                    body: 'Have not any reward programs active',
                });
            }
        }
    });

    screens.define_action_button({
        'name': 'reward_button',
        'widget': reward_button,
        'condition': function () {
            return this.pos.loyalty && this.pos.rules && this.pos.rules.length && this.pos.rules.length > 0;
        }
    });

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function (attributes, options) {
            _super_Order.initialize.apply(this, arguments);
            if (!this.plus_point) {
                this.plus_point = 0;
            }
            if (!this.redeem_point) {
                this.redeem_point = 0;
            }
        },
        init_from_JSON: function (json) {
            var res = _super_Order.init_from_JSON.apply(this, arguments);
            if (json.plus_point) {
                this.plus_point = json.plus_point;
            }
            if (json.redeem_point) {
                this.redeem_point = json.redeem_point;
            }
            return res;
        },
        export_as_JSON: function () {
            var json = _super_Order.export_as_JSON.apply(this, arguments);
            if (this.plus_point) {
                json.plus_point = this.plus_point;
            }
            if (this.redeem_point) {
                json.redeem_point = this.redeem_point;
            }
            return json;
        },
        export_for_printing: function () {
            var receipt = _super_Order.export_for_printing.call(this);
            receipt.plus_point = this.plus_point || 0;
            receipt.redeem_point = this.redeem_point || 0;
            return receipt
        },
        build_plus_point: function () {
            var total_point = 0;
            var lines = this.orderlines.models;
            if (lines.length == 0 || !lines) {
                return total_point;
            }
            var loyalty = this.pos.loyalty;
            if (!loyalty) {
                return total_point;
            }
            var rules = [];
            var rules_by_loylaty_id = this.pos.rules_by_loyalty_id[loyalty.id];
            if (!rules_by_loylaty_id) {
                return total_point;
            }
            for (var j = 0; j < rules_by_loylaty_id.length; j++) {
                rules.push(rules_by_loylaty_id[j]);
            }
            if (!rules) {
                return total_point;
            }
            if (rules.length) {
                for (var j = 0; j < lines.length; j++) { // TODO: reset plus point each line
                    var line = lines[j];
                    line.plus_point = 0;
                }
                // Todo: we have 3 type rule
                //      - plus point base on order amount total
                //      - plus point base on pos category
                //      - plus point base on amount total
                for (var j = 0; j < lines.length; j++) {
                    var line = lines[j];
                    if (line['redeem_point'] || line['promotion']) {
                        line['plus_point'] = 0;
                        continue;
                    } else {
                        line.plus_point = 0;
                        for (var i = 0; i < rules.length; i++) {
                            var rule = rules[i];
                            var plus_point = 0;
                            plus_point = line.get_price_with_tax() * rule['coefficient'];
                            if ((rule['type'] == 'products' && rule['product_ids'].indexOf(line.product['id']) != -1) || (rule['type'] == 'categories' && rule['category_ids'].indexOf(line.product.pos_categ_id[0]) != -1) || (rule['type'] == 'order_amount')) {
                                line.plus_point += plus_point;
                                total_point += plus_point;
                            }
                        }
                    }
                }
            }
            return total_point;
        },
        build_redeem_point: function () {
            var redeem_point = 0;
            var lines = this.orderlines.models;
            if (lines.length == 0 || !lines) {
                return redeem_point;
            }
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var line_redeem_point = line['redeem_point'] || 0;
                if (line_redeem_point) {
                    redeem_point += line_redeem_point;
                }
                if (line.credit_point) {
                    line['redeem_point'] = line.credit_point;
                    redeem_point += line.redeem_point;
                    line.credit_point = 0;
                }
                line.redeem_point = line_redeem_point;
            }
            return round_pr(redeem_point || 0, this.pos.loyalty.rounding);
        },
        get_client_point: function () {
            var client = this.get_client();
            if (!client) {
                return {
                    redeem_point: 0,
                    plus_point: 0,
                    pos_loyalty_point: 0,
                    remaining_point: 0,
                    next_point: 0,
                    client_point: 0
                }
            }
            var redeem_point = this.build_redeem_point();
            var plus_point = this.build_plus_point();
            if (this.pos.loyalty.rounding_down) {
                plus_point = parseInt(plus_point);
            }
            console.log('Plus point: ' + plus_point);
            var pos_loyalty_point = client.pos_loyalty_point || 0;
            var remaining_point = pos_loyalty_point - redeem_point;
            var next_point = pos_loyalty_point - redeem_point + plus_point;
            return {
                redeem_point: redeem_point,
                plus_point: plus_point,
                pos_loyalty_point: pos_loyalty_point,
                remaining_point: remaining_point,
                next_point: next_point,
                client_point: pos_loyalty_point,
            }
        }
    });

    var _super_Orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        init_from_JSON: function (json) {
            var res = _super_Orderline.init_from_JSON.apply(this, arguments);
            if (json.plus_point) {
                this.plus_point = json.plus_point;
            }
            if (json.redeem_point) {
                this.redeem_point = json.redeem_point;
            }
            if (json.reward_id) {
                this.reward_id = json.reward_id;
            }
            if (json.credit_point) {
                this.credit_point = json.credit_point
            }
            return res;
        },
        export_as_JSON: function () {
            var json = _super_Orderline.export_as_JSON.apply(this, arguments);
            if (this.plus_point) {
                json.plus_point = this.plus_point;
            }
            if (this.redeem_point) {
                json.redeem_point = this.redeem_point;
            }
            if (this.reward_id) {
                json.reward_id = this.reward_id;
            }
            if (this.credit_point) {
                json.credit_point = this.credit_point
            }
            return json;
        },
    });
    screens.OrderWidget.include({
        active_loyalty: function (buttons, selected_order) {
            var $loyalty_element = $(this.el).find('.loyalty-table');
            var lines = selected_order.orderlines.models;
            if (!lines || lines.length == 0) {
                buttons.reward_button.highlight(false);
            } else {
                var client = selected_order.get_client();
                var $plus_point = this.el.querySelector('.plus_point');
                var $redeem_point = this.el.querySelector('.redeem_point');
                var $remaining_point = this.el.querySelector('.remaining_point');
                var $client_point = this.el.querySelector('.client_point');
                var $next_point = this.el.querySelector('.next_point');
                if (client) {
                    $loyalty_element.animate({opacity: 1,}, 200, 'swing', function () {
                        $loyalty_element.removeClass('oe_hidden');
                    });
                    var points = selected_order.get_client_point();
                    var plus_point = points['plus_point'];
                    if ($plus_point) {
                        $plus_point.textContent = this.format_currency_no_symbol(plus_point);
                    }
                    if ($redeem_point) {
                        $redeem_point.textContent = this.format_currency_no_symbol(points['redeem_point']);
                    }
                    if ($client_point) {
                        $client_point.textContent = this.format_currency_no_symbol(points['client_point']);
                    }
                    if ($remaining_point) {
                        $remaining_point.textContent = this.format_currency_no_symbol(points['remaining_point']);
                    }
                    if ($next_point) {
                        $next_point.textContent = this.format_currency_no_symbol(points['next_point']);
                    }
                    selected_order.plus_point = plus_point;
                    selected_order.redeem_point = points['redeem_point'];
                    selected_order.remaining_point = points['remaining_point'];
                    if (client['pos_loyalty_point'] > points['redeem_point'] && buttons && buttons.reward_button) {
                        buttons.reward_button.highlight(true);
                    } else if (client['pos_loyalty_point'] <= points['redeem_point'] && buttons && buttons.reward_button) {
                        buttons.reward_button.highlight(false);
                    }
                } else {
                    buttons.reward_button.highlight(false);
                }
            }
        },
        update_summary: function () {
            this._super();
            var buttons = this.getParent().action_buttons;
            var order = this.pos.get_order();
            if (order && buttons && buttons.reward_button && this.pos.loyalty) {
                this.active_loyalty(buttons, order);
            }
        }
    })
});
