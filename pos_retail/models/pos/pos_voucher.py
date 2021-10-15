# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)


class pos_order(models.Model):
    _inherit = "pos.order"

    voucher_id = fields.Many2one('pos.voucher', 'Voucher Used')

    @api.model
    def _order_fields(self, ui_order):
        order_fields = super(pos_order, self)._order_fields(ui_order)
        if ui_order.get('voucher_id', False):
            order_fields.update({
                'voucher_id': ui_order['voucher_id']
            })
        return order_fields


class pos_voucher(models.Model):
    _name = "pos.voucher"
    _rec_name = 'code'
    _order = 'end_date'
    _description = "Management POS voucher"

    customer_id = fields.Many2one('res.partner', string='Customer', domain=[('customer', '=', True)])
    code = fields.Char('Code')
    start_date = fields.Datetime('Start date', required=1)
    end_date = fields.Datetime('End date', required=1)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('used', 'Used'),
        ('removed', 'Removed')
    ], string='State', default='draft')
    value = fields.Float('Balance Value')
    apply_type = fields.Selection([
        ('fixed_amount', 'Fixed amount'),
        ('percent', 'Percent (%)'),
    ], string='Apply type', default='fixed_amount')
    method = fields.Selection([
        ('general', 'General'),
        ('special_customer', 'Special Customer'),
    ], string='Method', default='general')
    use_date = fields.Datetime('Use date')
    user_id = fields.Many2one('res.users', 'Create user', readonly=1)
    source = fields.Char('Source document')
    pos_order_id = fields.Many2one('pos.order', 'Pos order', readonly=1)
    pos_order_line_id = fields.Many2one('pos.order.line', 'Pos order line', readonly=1)
    use_history_ids = fields.One2many('pos.voucher.use.history', 'voucher_id', string='Histories used', readonly=1)
    number = fields.Char('Number')

    def create_voucher(self, order):
        today = datetime.today()
        end_date = today + timedelta(days=order.config_id.expired_days_voucher)
        self.create({
            'customer_id': order.partner_id and order.partner_id.id if order.partner_id else None,
            'start_date': fields.Datetime.now(),
            'end_date': end_date,
            'state': 'active',
            'value': - order.amount_total,
            'apply_type': 'fixed_amount',
            'method': 'general',
            'source': order.name,
            'pos_order_id': order.id,
            'user_id': self.env.user.id
        })
        return True

    @api.multi
    def order_return_become_voucher(self, voucher_val={}, origin='',
                                    partner_id=None, picking_type_id=None, location_dest_id=None,
                                    note='', pos_order_id=None, lines=[]):
        today = datetime.today()
        end_date = today + timedelta(days=voucher_val['period_days'])
        val = {
            'number': voucher_val.get('number', None) if voucher_val.get('number', None) else '',
            'customer_id': voucher_val.get('customer_id', None),
            'start_date': fields.Datetime.now(),
            'end_date': end_date,
            'state': 'active',
            'value': voucher_val.get('value'),
            'apply_type': voucher_val.get('apply_type', None) if voucher_val.get('apply_type',
                                                                                 None) else 'fixed_amount',
            'method': voucher_val.get('method', None) if voucher_val.get('method', None) else 'general',
            'source': voucher_val.get('source'),
            'user_id': self.env.user.id
        }
        voucher = self.env['pos.voucher'].sudo().create(val)
        voucher_val.update({
            'code': voucher.code,
            'value': voucher.value
        })
        self.env['pos.order'].create_picking_return(origin, partner_id, picking_type_id,
                                                    location_dest_id, note, pos_order_id, lines)
        return voucher_val

    @api.multi
    def get_vouchers_by_order_ids(self, order_ids):
        vouchers_data = []
        orders = self.env['pos.order'].sudo().browse(order_ids)
        for order in orders:
            line_ids = [line.id for line in order.lines]
            vouchers = self.sudo().search([('pos_order_line_id', 'in', line_ids)])
            for voucher in vouchers:
                vouchers_data.append({
                    'number': voucher.number,
                    'code': voucher.code,
                    'partner_name': voucher.customer_id.name if voucher.customer_id else '',
                    'method': voucher.method,
                    'apply_type': voucher.apply_type,
                    'value': voucher.value,
                    'start_date': voucher.end_date,
                    'end_date': voucher.end_date,
                    'id': voucher.id,
                })
            if order.create_voucher:
                vouchers = self.sudo().search([('pos_order_id', '=', order.id)])
                for voucher in vouchers:
                    vouchers_data.append({
                        'number': voucher.number,
                        'code': voucher.code,
                        'partner_name': voucher.customer_id.name if voucher.customer_id else '',
                        'method': voucher.method,
                        'apply_type': voucher.apply_type,
                        'value': voucher.value,
                        'start_date': voucher.end_date,
                        'end_date': voucher.end_date,
                        'id': voucher.id,
                        'user_id': self.env.user.id
                    })
        return vouchers_data

    @api.model
    def create(self, vals):
        voucher = super(pos_voucher, self).create(vals)
        if not voucher.code:
            format_code = "%s%s%s" % ('999', voucher.id, datetime.now().strftime("%d%m%y%H%M"))
            code = self.env['barcode.nomenclature'].sanitize_ean(format_code)
            voucher.write({'code': code})
            if not voucher.number:
                voucher.write({'number': voucher.code})
        _logger.info('NEW VOUCHER: %s' % voucher.number)
        return voucher

    @api.multi
    def remove_voucher(self):
        return self.write({
            'state': 'removed'
        })

    @api.model
    def get_voucher_by_code(self, code):
        vouchers = self.env['pos.voucher'].search(
            ['|', ('code', '=', code), ('number', '=', code), ('end_date', '>=', fields.Datetime.now()),
             ('state', '=', 'active')])
        if not vouchers:
            return -1
        else:
            return vouchers.read([])[0]


class pos_voucher_use_history(models.Model):
    _name = "pos.voucher.use.history"
    _description = "Histories use voucher of customer"

    voucher_id = fields.Many2one('pos.voucher', required=1, string='Voucher', ondelete='cascade')
    value = fields.Float('Value used', required=1)
    used_date = fields.Datetime('Used date', required=1)
