# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from psycopg2.extensions import AsIs
import logging

_logger = logging.getLogger(__name__)

class account_bank_statement_line(models.Model):
    _inherit = "account.bank.statement.line"

    voucher_id = fields.Many2one('pos.voucher', 'Voucher', readonly=1)
    pos_session_id = fields.Many2one('pos.session', 'POS Session')
    pos_cash_type = fields.Selection([
        ('none', 'None'),
        ('in', 'In'),
        ('out', 'Out')
    ], string='POS Cash Type', default='none')

    def fast_counterpart_creation(self):
        from_pos = False
        for st_line in self:
            if st_line.amount_currency != 0 and st_line.pos_statement_id and st_line.pos_statement_id.create_uid and st_line.pos_statement_id.create_uid.company_id and st_line.pos_statement_id.create_uid.company_id.currency_id and st_line.pos_statement_id.create_uid.company_id.currency_id.id != st_line.currency_id.id:
                from_pos = True
        if from_pos == True:
            for st_line in self:
                vals = {}
                if st_line.pos_statement_id and st_line.pos_statement_id.create_uid and st_line.pos_statement_id.create_uid.company_id and st_line.pos_statement_id.create_uid.company_id.currency_id and st_line.pos_statement_id.create_uid.company_id.currency_id.id != st_line.currency_id.id:
                    vals = {
                        'name': st_line.name,
                        'debit': st_line.amount_currency < 0 and -st_line.amount_currency or 0.0,
                        'credit': st_line.amount_currency > 0 and st_line.amount_currency or 0.0,
                        'account_id': st_line.account_id.id,
                        'currency_id': st_line.currency_id.id,
                        'amount_currency': st_line.amount_currency,
                    }
                else:
                    vals = {
                        'name': st_line.name,
                        'debit': st_line.amount < 0 and -st_line.amount or 0.0,
                        'credit': st_line.amount > 0 and st_line.amount or 0.0,
                        'account_id': st_line.account_id.id,
                    }
                st_line.process_reconciliation(new_aml_dicts=[vals])
        else:
            return super(account_bank_statement_line, self).fast_counterpart_creation()

    @api.model
    def create(self, vals):
        # -----------------------------
        # if amount > 0: this is mean customer use credit payment pos order
        # if amount < 0: this is mean customer get change when have change money
        # -----------------------------
        statement_line = super(account_bank_statement_line, self).create(vals)
        credit_object = self.env['res.partner.credit']
        if vals.get('pos_statement_id', False) \
                and statement_line.journal_id \
                and statement_line.journal_id.pos_method_type == 'credit' \
                and statement_line.pos_statement_id \
                and statement_line.pos_statement_id.partner_id:
            amount = statement_line.amount
            if amount > 0:
                credit_object.create({
                    'name': statement_line.pos_statement_id.name,
                    'type': 'redeem',
                    'amount': amount,
                    'pos_order_id': statement_line.pos_statement_id.id,
                    'partner_id': statement_line.pos_statement_id.partner_id.id,
                })
            else:
                credit_object.create({
                    'name': statement_line.pos_statement_id.name,
                    'type': 'plus',
                    'amount': - amount,
                    'pos_order_id': statement_line.pos_statement_id.id,
                    'partner_id': statement_line.pos_statement_id.partner_id.id,
                })
        if statement_line.voucher_id:
            _logger.info('register payment with voucher code: %s' % statement_line.voucher_id)
            if statement_line.voucher_id.apply_type == 'percent':
                statement_line.voucher_id.write({'state': 'used', 'use_date': fields.Datetime.now()})
                self.env['pos.voucher.use.history'].create({
                    'voucher_id': statement_line.voucher_id.id,
                    'value': statement_line.amount,
                    'used_date': fields.Datetime.now()
                })
            else:
                amount = statement_line.amount
                value = statement_line.voucher_id.value
                _logger.info('voucher value: %s' % value)
                _logger.info('used value: %s' % amount)
                if (value - amount) <= 0:
                    statement_line.voucher_id.write({
                        'state': 'used',
                        'use_date': fields.Datetime.now(),
                        'value': 0,
                    })
                else:
                    statement_line.voucher_id.write({'value': (value - amount)})
                self.env['pos.voucher.use.history'].create({
                    'voucher_id': statement_line.voucher_id.id,
                    'value': statement_line.amount,
                    'used_date': fields.Datetime.now()
                })
        return statement_line
