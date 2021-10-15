# -*- coding: utf-8 -*-
from odoo import api, fields, models, tools, _, registry
from odoo.exceptions import UserError
from odoo import SUPERUSER_ID
import odoo
import logging

_logger = logging.getLogger(__name__)


class pos_session(models.Model):
    _inherit = "pos.session"

    closed_at = fields.Datetime(string='Closed Date', readonly=True, copy=False)

    def _confirm_orders(self):
        # We're have not solution how to break out order with status partial_payment
        # Hope next version odoo dont do that
        for session in self:
            user = session.user_id
            company_id = session.config_id.journal_id.company_id.id
            orders = session.order_ids.filtered(lambda order: order.state == 'paid')
            journal_id = self.env['ir.config_parameter'].sudo().get_param(
                'pos.closing.journal_id_%s' % company_id, default=session.config_id.journal_id.id)
            if not journal_id:
                raise UserError(_("You have to set a Sale Journal for the POS:%s") % (session.config_id.name,))

            move = self.env['pos.order'].with_context(force_company=company_id)._create_account_move(session.start_at,
                                                                                                     session.name,
                                                                                                     int(journal_id),
                                                                                                     company_id)
            orders.with_context(force_company=company_id)._create_account_move_line(session, move)
            for order in session.order_ids.filtered(lambda o: o.state not in ['done', 'invoiced', 'partial_payment']):
                if order.state not in ('paid'):
                    raise UserError(
                        _("You cannot confirm all orders of this session, because they have not the 'paid' status.\n"
                          "{reference} is in state {state}, total amount: {total}, paid: {paid}").format(
                            reference=order.pos_reference or order.name,
                            state=order.state,
                            total=order.amount_total,
                            paid=order.amount_paid,
                        ))
                order.action_pos_order_done()
            orders_to_reconcile = session.order_ids.filtered(
                lambda order: order.state in ['invoiced', 'done'] and order.partner_id)
            orders_to_reconcile.sudo()._reconcile_payments()

    @api.multi
    def get_pos_session(self, session_id):
        if session_id:
            session = self.browse(int(session_id))
        if session:
            if session.user_id.has_group('point_of_sale.group_pos_manager'):
                admin = 1
            else:
                admin = 0
            pos_session = {"id": session.id,
                           "name": session.name,
                           "user_id": [session.user_id.id,
                                       session.user_id.name],
                           "cash_control": session.cash_control,
                           "state": session.state,
                           "stop_at": session.stop_at,
                           "config_id": [session.config_id.id,
                                         session.config_id.display_name],
                           "start_at": session.start_at,
                           "currency_id": [session.currency_id.id,
                                           session.currency_id.name],
                           "cash_register_balance_end_real": (
                               session.cash_register_balance_end_real),
                           "cash_register_total_entry_encoding": (
                               session.cash_register_total_entry_encoding),
                           "cash_register_difference": (
                               session.cash_register_difference),
                           "cash_register_balance_start": (
                               session.cash_register_balance_start),
                           "cash_register_balance_end": (
                               session.cash_register_balance_end),
                           "is_admin": (admin)
                           }
            return pos_session
        else:
            return

    @api.multi
    def get_cashbox(self, session_id, balance):
        is_delete = True
        access_model = self.env['ir.model.access'].sudo().search(
            [('name', 'ilike', 'account.cashbox.line user')]
        )
        # Hide Delete icon in POS Closing Balance popup if Technical Settings/Show Full Accounting Features and
        # Delete Access options are not checked.
        if not self.user_has_groups('account.group_account_user') and not access_model.perm_unlink:
            is_delete = False
        session = self.browse(int(session_id))
        session.ensure_one()
        context = dict(session._context)
        balance_type = balance or 'end'
        context['bank_statement_id'] = session.cash_register_id.id
        context['balance'] = balance_type
        context['default_pos_id'] = session.config_id.id
        cashbox_id = None
        if balance_type == 'start':
            cashbox_id = session.cash_register_id.cashbox_start_id.id
        else:
            cashbox_id = session.cash_register_id.cashbox_end_id.id
        cashbox_line = []
        total = 0
        if cashbox_id:
            account_cashbox_line = self.env['account.cashbox.line']
            cashbox = account_cashbox_line.search([
                ('cashbox_id', '=', cashbox_id)
            ])
            if cashbox:
                for line in cashbox:
                    subtotal = line.number * line.coin_value
                    total += subtotal
                    cashbox_line.append({"id": line.id,
                                         "number": line.number,
                                         "coin_value": line.coin_value,
                                         "subtotal": subtotal,
                                         "total": total,
                                         "is_delete": is_delete
                                         })
            else:
                cashbox_line.append({"total": total,
                                     "is_delete": is_delete
                                     })
        else:
            cashbox_line.append({"total": total,
                                 "is_delete": is_delete
                                 })
        return cashbox_line


class AccountBankStmtCashWizard(models.Model):
    """
    Account Bank Statement popup that allows entering cash details.
    """
    _inherit = 'account.bank.statement.cashbox'
    _description = 'Account Bank Statement Cashbox Details'

    description = fields.Char("Description")

    @api.multi
    def remove_cashbox_line(self, cashbox_line_id):
        return self.env['account.cashbox.line'].browse(cashbox_line_id).unlink()

    @api.multi
    def validate_from_ui(self, session_id, balance, values):
        """ Create , Edit , Delete of Closing Balance Grid

        :param session_id: POS Open Session id .
        :param values: Array records to save

        :return: Array of cashbox line.
        """
        session = self.env['pos.session'].browse(int(session_id))
        bnk_stmt = session.cash_register_id
        if (balance == 'start'):
            self = session.cash_register_id.cashbox_start_id
        else:
            self = session.cash_register_id.cashbox_end_id
        if not self:
            self = self.create({'description': "Created from POS"})
            if self and (balance == 'end'):
                account_bank_statement = session.cash_register_id
                account_bank_statement.write({'cashbox_end_id': self.id})
        for val in values:
            id = val['id']
            number = val.get('number', 0)
            coin_value = val.get('coin_value', 0)
            cashbox_line = self.env['account.cashbox.line']
            if id and number and coin_value:  # Add new Row
                cashbox_line = cashbox_line.browse(id)
                cashbox_line.write({
                    'number': number,
                    'coin_value': coin_value
                })
            elif not id and number and coin_value:  # Add new Row
                cashbox_line.create(
                    {'number': number,
                     'coin_value': coin_value,
                     'cashbox_id': self.id
                     })
        total = 0.0
        for lines in self.cashbox_lines_ids:
            total += lines.subtotal
        if (balance == 'start'):
            # starting balance
            bnk_stmt.write({
                'balance_start': total,
                'cashbox_start_id': self.id
            })
        else:
            # closing balance
            bnk_stmt.write({
                'balance_end_real': total,
                'cashbox_end_id': self.id
            })
        if (balance == 'end'):
            if bnk_stmt.difference < 0:
                if self.env.user.id == SUPERUSER_ID:
                    return (_('you have to send more %s %s') %
                            (bnk_stmt.currency_id.symbol,
                             abs(bnk_stmt.difference)))
                else:
                    return (_('you have to send more amount'))
            elif bnk_stmt.difference > 0:
                if self.env.user.id == SUPERUSER_ID:
                    return (_('you may be missed some bills equal to %s %s')
                            % (bnk_stmt.currency_id.symbol,
                               abs(bnk_stmt.difference)))
                else:
                    return (_('you may be missed some bills'))
            else:
                return (_('you done a Great Job'))
        else:
            return

    @api.multi
    def validate(self):
        """Raise popup for set closing balance in session POS

        :rtype: dict

        """
        res = super(AccountBankStmtCashWizard, self).validate()
        bnk_stmt_id = (self.env.context.get('bank_statement_id', False) or
                       self.env.context.get('active_id', False))
        bnk_stmt = self.env['account.bank.statement'].browse(bnk_stmt_id)
        if bnk_stmt.pos_session_id.state == 'closing_control':
            if bnk_stmt.difference < 0:
                raise UserError(_('you have to send more %s %s') % (
                    bnk_stmt.currency_id.symbol,
                    abs(bnk_stmt.difference)))
            elif bnk_stmt.difference > 0:
                raise UserError(_('you may be missed some '
                                  'bills equal to %s %s') % (
                                    bnk_stmt.currency_id.symbol,
                                    abs(bnk_stmt.difference)))
            else:
                return res
        else:
            return res
