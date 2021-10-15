# -*- coding: utf-8 -*-
from odoo import api, models, fields, registry
import odoo
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
import json
import logging

_logger = logging.getLogger(__name__)


class pos_call_log(models.Model):
    _rec_name = "call_model"
    _name = "pos.call.log"
    _description = "Log datas of pos sessions"

    min_id = fields.Integer('Min Id', required=1, index=True, readonly=1)
    max_id = fields.Integer('Max Id', required=1, index=True, readonly=1)
    call_domain = fields.Char('Domain', required=1, index=True, readonly=1)
    call_results = fields.Char('Results', readonly=1)
    call_model = fields.Char('Model', required=1, index=True, readonly=1)
    call_fields = fields.Char('Fields', index=True, readonly=1)
    active = fields.Boolean('Active', default=True)
    write_date = fields.Datetime('Write date', readonly=1)

    @api.multi
    def compare_database_write_date(self, model, pos_write_date):
        last_logs = self.search([('call_model', '=', model), ('write_date', '<', pos_write_date)])
        if last_logs:
            _logger.info('POS write date is %s' % pos_write_date)
            _logger.info('Model %s write date is %s' % (model, last_logs[0].write_date))
            return True
        else:
            return False

    def covert_datetime(self, model, datas):
        all_fields = self.env[model].fields_get()
        version_info = odoo.release.version_info[0]
        if version_info == 12:
            if all_fields:
                for data in datas:
                    for field, value in data.items():
                        if field == 'model':
                            continue
                        if all_fields[field] and all_fields[field]['type'] in ['date', 'datetime'] and value:
                            data[field] = value.strftime(DEFAULT_SERVER_DATETIME_FORMAT)
        return datas

    @api.multi
    def refresh_logs(self):
        _logger.info('Begin refresh_logs()')
        self.env['pos.cache.database'].sudo().search([]).unlink()
        logs = self.search([])
        _logger.info(logs)
        for log in logs:
            log.refresh_log()
        self.env['pos.config'].sudo().search([]).write({'required_reinstall_cache': True})
        return True

    @api.model
    def refresh_log(self):
        cache_database_object = self.env['pos.cache.database']
        cache_database_object.installing_datas(self.call_model, self.min_id, self.max_id)
        return True
