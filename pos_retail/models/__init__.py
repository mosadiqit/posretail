# -*- coding: utf-8 -*-
from . import medical
from . import product
from . import pos
from . import account
from . import res
from . import sale
from . import stock
from . import purchase
from . import multi_pricelist
import odoo

version_info = odoo.release.version_info

if version_info[0] and version_info[0] != 13:
    from . import account_invoice
if version_info[0] and version_info[0] == 12:
    from . import v12
if version_info[0] and version_info[0] == 11:
    from . import v11
if version_info[0] and version_info[0] == 10:
    from . import v10
