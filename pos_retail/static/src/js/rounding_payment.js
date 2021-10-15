odoo.define('pos_retail.rounding_payment', function (require) {
    "use strict";

    var pos_model = require('point_of_sale.models');
    var screen = require('point_of_sale.screens');
    var utils = require('web.utils');

    pos_model.load_fields('account.journal', ['decimal_rounding']);

    screen.PaymentScreenWidget.include({
        click_paymentmethods: function (id) { // auto add rounding line to payment lines
            this._super(id);
            var current_order = this.pos.get_order();
            var cashregister_rounding = _.find(this.pos.cashregisters, function (register) {
                return register.journal.pos_method_type == 'rounding';
            });
            if (!current_order || !cashregister_rounding) {
                return;
            }
            var selected_paymentline = current_order.selected_paymentline;
            var due = current_order.get_due();
            var after_round = Math.round(due * Math.pow(10, cashregister_rounding.journal.decimal_rounding)) /  Math.pow(10, cashregister_rounding.journal.decimal_rounding);
            var amount_round = after_round - due;
            if (amount_round == 0) {
                return;
            }
            var payment_line_rounding = _.find(current_order.paymentlines.models, function (payment) {
                return payment.cashregister.journal.pos_method_type == 'rounding';
            });
            if (payment_line_rounding) {
                payment_line_rounding.set_amount(-amount_round);
            } else {
                current_order.add_paymentline(cashregister_rounding);
                current_order.selected_paymentline.set_amount(-amount_round);
            }
            current_order.select_paymentline(selected_paymentline);
            this.reset_input();
            this.order_changes();
            this.render_paymentlines();
            // this.$('.paymentline.selected .edit').text(amount_round);
        }
    });
});
