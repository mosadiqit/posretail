# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.tools import float_is_zero

import logging

_logger = logging.getLogger(__name__)

class PosOrderLineLot(models.Model):
    _inherit = "pos.pack.operation.lot"

    quantity = fields.Float('Quantity')
    lot_id = fields.Many2one('stock.production.lot', 'Lot/Serial Number')

class PosOrder(models.Model):
    _inherit = "pos.order"

    def set_pack_operation_lot(self, picking=None):
        """Set Serial/Lot number in pack operations to mark the pack operation done."""

        PosPackOperationLot = self.env['pos.pack.operation.lot']
        has_wrong_lots = False
        for order in self:
            config = order.session_id.config_id
            if not config.multi_lots: # We return odoo original if not active multi lots on pos config
                return super(PosOrder, self).set_pack_operation_lot(picking)
            for move in (picking or self.picking_id).move_lines:
                picking_type = (picking or self.picking_id).picking_type_id
                lots_necessary = True
                if picking_type:
                    lots_necessary = picking_type and picking_type.use_existing_lots
                qty = 0
                qty_done = 0
                pack_lots = []
                pos_pack_lots = PosPackOperationLot.search([
                    ('order_id', '=', order.id),
                    ('product_id', '=', move.product_id.id),
                    ('lot_id', '!=', None),
                    ('quantity', '!=', 0)
                ])
                if lots_necessary:
                    for pos_pack_lot in pos_pack_lots:
                        qty = pos_pack_lot.quantity
                        qty_done += qty
                        pack_lots.append({
                            'lot_id': pos_pack_lot.lot_id.id,
                            'qty': qty
                        })
                for pack_lot in pack_lots:
                    lot_id, qty = pack_lot['lot_id'], pack_lot['qty']
                    self.env['stock.move.line'].create({
                        'move_id': move.id,
                        'product_id': move.product_id.id,
                        'product_uom_id': move.product_uom.id,
                        'qty_done': qty,
                        'location_id': move.location_id.id,
                        'location_dest_id': move.location_dest_id.id,
                        'lot_id': lot_id,
                    })
                if not pack_lots and not float_is_zero(qty_done, precision_rounding=move.product_uom.rounding):
                    if len(move._get_move_lines()) < 2:
                        move.quantity_done = qty_done
                    else:
                        move._set_quantity_done(qty_done)
        return has_wrong_lots