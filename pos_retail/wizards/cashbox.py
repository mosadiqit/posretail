# -*- coding: utf-8 -*-
from odoo import api
from odoo.addons.account.wizard.pos_box import CashBox
import logging

_logger = logging.getLogger(__name__)

class Pos_Box(CashBox):
    _register = False

    @api.multi
    def cash_input_from_pos(self, values):
        _logger.info('%s' % values)
        active_model = 'pos.session'
        active_ids = values['session_id']
        reason = values['reason']
        amount = values['amount']
        context = {'active_model': active_model, 'active_ids': active_ids, 'active_id': values['session_id']}

        if reason and float(amount):
            self = self.create({'name': reason, 'amount': amount})
            bank_statements = [session.cash_register_id for session in
                               self.env[active_model].browse(active_ids)
                               if session.cash_register_id]
            if not bank_statements:
                return ("There is no cash register for this PoS Session")
            self.with_context(context)._run(bank_statements)
            return
        else:
            return ("Reason and Amount is Required Fields ")

    def update_pos_session_to_account_bank_statement_line(self, values, pos_cash_type):
        context = self._context
        active_id = context.get('active_id', None)
        active_model = context.get('active_model', None)
        if active_model == 'pos.session' and active_id:
            values.update({
                'pos_session_id': active_id,
                'pos_cash_type': pos_cash_type
            })
        return values

class Pos_BoxIn(Pos_Box):
    _inherit = 'cash.box.in'

    @api.multi
    def _calculate_values_for_statement_line(self, record):
        values = super(Pos_BoxIn, self)._calculate_values_for_statement_line(record)
        values = self.update_pos_session_to_account_bank_statement_line(values, 'in')
        _logger.info('in: %s' % values)
        return values

class PosBoxOut(Pos_Box):
    _inherit = 'cash.box.out'

    @api.multi
    def _calculate_values_for_statement_line(self, record):
        values = super(PosBoxOut, self)._calculate_values_for_statement_line(record)
        values = self.update_pos_session_to_account_bank_statement_line(values, 'out')
        _logger.info('out: %s' % values)
        return values