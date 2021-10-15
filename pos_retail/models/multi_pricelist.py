# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError

class currency(models.Model):
    _inherit = 'res.currency'

    company_id = fields.Many2one(
        'res.company',
        string='Company', required=True,
        default=lambda self: self.env.user.company_id)
    converted_currency = fields.Float('Converted Currency', compute="_onchange_currency")

    @api.depends('company_id')
    def _onchange_currency(self):
        company_currency = self.env.user.company_id.currency_id
        for i in self:
            if i.id == company_currency.id:
                i.converted_currency = 1
            else:
                rate = (i.rate / company_currency.rate)
                i.converted_currency = rate


class POSConfig(models.Model):
    _inherit = 'pos.config'

    @api.constrains('pricelist_id', 'available_pricelist_ids', 'journal_id', 'invoice_journal_id', 'journal_ids')
    def _check_currencies(self):
        if self.pricelist_id not in self.available_pricelist_ids:
            raise ValidationError(_("The default pricelist must be included in the available pricelists."))
        if self.invoice_journal_id.currency_id and self.invoice_journal_id.currency_id != self.currency_id:
            raise ValidationError(_(
                "The invoice journal must be in the same currency as the Sales Journal or the company currency if that is not set."))
        if any(self.journal_ids.mapped(
                lambda journal: self.currency_id not in (journal.company_id.currency_id, journal.currency_id))):
            raise ValidationError(_(
                "All payment methods must be in the same currency as the Sales Journal or the company currency if that is not set."))

    def new_rate(self, from_amount, to_currency):
        pricelist_currency = self.env['res.currency'].browse(to_currency)
        company_currency = self.company_id.currency_id
        new_rate = company_currency._convert(from_amount, pricelist_currency,
                                             self.company_id or self.env.user.company_id, fields.Date.today())
        return new_rate
