1) remove line views/product.xml on __manifest__.py
2) do upgrade pos_retail 
3) add back line "views/product.xml" to manifest
4) do upgrade again 
DONE

---------------------------
7.3.5
1) Open your terminal odoo server running
2) Stop odoo service
3) Running odoo upgrade 
Example: $p python3 [ path of odoo-bin odoo] -c [your config odoo file] -d [database need upgrade] -u pos_retail
4) Stop step 3 (Ctrl + C)
5) Open service odoo
6) Login your odoo and DONE