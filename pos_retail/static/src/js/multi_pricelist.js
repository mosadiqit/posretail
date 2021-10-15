odoo.define('pos_retail.multi_pricelist', function (require) {
    "use strict";

    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var field_utils = require('web.field_utils');
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var round_di = utils.round_decimals;
    var retail_model = require('pos_retail.model');
    var retail_payment_screen = require('pos_retail.screen_payment');
    var screens = require('point_of_sale.screens');

    screens.PaymentScreenWidget.include({
        click_paymentmethods: function (id) {
            if (id) {
                var order_selected = this.pos.get_order();
                var journal_selected = this.pos.journal_by_id[id];
                if ((journal_selected && order_selected.currency && journal_selected.currency_id && journal_selected.currency_id[0] != order_selected.currency.id) || !journal_selected.currency_id) {
                    return this.pos.gui.show_popup('dialog', {
                        title: 'Error',
                        body: 'Not allow add  Payment Method have difference Journal Currency with your selected Pricelist (or pos config) Currency'
                    })
                }
            }
            this._super(id);
        },
    });
    PosBaseWidget.include({
        init: function (parent, options) {
            this._super(parent, options);
        },
        format_currency: function (amount, precision) {
            var order_selected = this.pos.get_order();
            if (order_selected && order_selected.currency && order_selected.currency.id != this.pos.config.currency_id[0]) {
                var currency = (order_selected && order_selected.currency) ? order_selected.currency : {
                    symbol: '$',
                    position: 'after',
                    rounding: 0.01,
                    decimals: 2
                };
                amount = this.format_currency_no_symbol(amount, precision);
                if (currency.position === 'after') {
                    return amount + ' ' + (currency.symbol || '');
                } else {
                    return (currency.symbol || '') + ' ' + amount;
                }
            } else {
                return this._super(amount, precision);
            }
        },
    });

    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            var pricelist_model = _.find(this.models, function (model) {
                return model.model === 'product.pricelist';
            });
            if (pricelist_model) {
                pricelist_model.fields.push('id', 'currency_id');
                var _super_loaded_pricelist_model = pricelist_model.loaded;
                pricelist_model.loaded = function (self, pricelists) {
                    for (var i = 0; i < pricelists.length; i++) {
                        var pricelist = pricelists[i];
                        if (pricelist.currency_id) {
                            pricelist.name = pricelist.name + ' (' + pricelist.currency_id[1] + ')'
                            continue
                        }
                        if (!pricelist.currency_id) {
                            pricelist.name = pricelist.name + ' (' + self.pos.config.currency_id[1] + ')';
                            continue
                        }
                    }
                    _super_loaded_pricelist_model(self, pricelists);
                };
            }
            var journal_model = this.get_model('account.journal');
            if (journal_model) {
                var _super_journal_loaded = journal_model.loaded;
                journal_model.loaded = function (self, journals) {
                    for (var n = 0; n < journals.length; n++) {
                        var journal = journals[n];
                        if (!journal.currency_id) {
                            journal.currency_id = self.config.currency_id;
                        }
                    }
                    _super_journal_loaded(self, journals);
                };
            }
            return _super_posmodel.initialize.call(this, session, attributes);
        },
        get_price: function (product, pricelist, quantity) { // TODO :we overide method get_price of pos_retail.model line 485
            var price = _super_posmodel.get_price.call(this, product, pricelist, quantity);
            var pos_config_currency_id = this.config.currency_id[0];
            var config_currency = this.currency_by_id[pos_config_currency_id];
            if (pricelist.currency_id && config_currency != pricelist.currency_id[0]) {
                var currency_selected = this.currency_by_id[pricelist.currency_id[0]];
                if (currency_selected && currency_selected['converted_currency']) {
                    var price_coverted = (currency_selected['converted_currency'] * price);
                    price = price_coverted
                }
            }
            return price
        },
    });

    var super_product = models.Product.prototype;
    models.Product = models.Product.extend({
        get_price: function (pricelist, quantity) {
            if (!pricelist) {
                return this.lst_price;
            }
            var price = super_product.get_price.call(this, pricelist, quantity);
            var pos_config_currency_id = self.posmodel.config.currency_id[0];
            var config_currency = self.posmodel.currency_by_id[pos_config_currency_id];
            if (pricelist.currency_id && config_currency != pricelist.currency_id[0]) {
                var currency_selected = self.posmodel.currency_by_id[pricelist.currency_id[0]];
                if (currency_selected && currency_selected['converted_currency']) {
                    var price_coverted = (currency_selected['converted_currency'] * price);
                    price = price_coverted
                }
            }
            return price;
        },
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function (attr, options) {
            _super_order.initialize.call(this, attr, options);
            if (!options.json) {
                var pos_config_currency_id = this.pos.config.currency_id[0];
                var config_currency = this.pos.currency_by_id[pos_config_currency_id];
                if (config_currency) {
                    this.currency = config_currency;
                }
            }
        },
        set_pricelist: function (pricelist) {
            var self = this;
            if (!this.is_return) {
                var pos_config_currency_id = this.pos.config.currency_id[0];
                var config_currency = this.pos.currency_by_id[pos_config_currency_id];
                if (pricelist.currency_id && config_currency != pricelist.currency_id[0]) {
                    var currency_selected = this.pos.currency_by_id[pricelist.currency_id[0]];
                    this.currency = currency_selected;
                    this.pricelist = pricelist;
                    var lines_to_recompute = _.filter(this.get_orderlines(), function (line) {
                        return !line.price_manually_set;
                    });
                    _.each(lines_to_recompute, function (line) {
                        line.set_unit_price(line.product.get_price(self.pricelist, line.get_quantity()));
                        self.fix_tax_included_price(line);
                    });
                }
                this.trigger('change');
            }
            _super_order.set_pricelist.apply(this, arguments);

        },
        export_as_JSON: function () {
            var json = _super_order.export_as_JSON.apply(this, arguments);
            if (this.currency) {
                json.currency_id = this.currency.id
            }
            return json;
        },
        init_from_JSON: function (json) {
            _super_order.init_from_JSON.call(this, json);
            if (json.currency_id) {
                this.currency = this.pos.currency_by_id[json.currency_id]
            }
        },
    });

});
