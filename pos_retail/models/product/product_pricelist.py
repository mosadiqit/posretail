# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError
import odoo

class product_cross(models.Model):

    _inherit = "product.pricelist"

    @api.multi
    def sync_pricelists_all_pos_online(self):
        version_info = odoo.release.version_info
        if version_info and version_info[0] == 10:
            raise UserError('Sorry, this function not supported odoo version 10')
        else:
            sessions = self.env['pos.session'].sudo().search([
                ('state', '=', 'opened')
            ])
            for session in sessions:
                self.env['bus.bus'].sendmany(
                    [[(self.env.cr.dbname, 'pos.sync.pricelists', session.user_id.id), {}]])
        return True