'use server'

import React from 'react'
import { getSaleById } from '@/lib/actions'
import { notFound } from 'next/navigation'

export default async function PrintSalePage({ params }: { params: { id: string } }) {
  const sale = await getSaleById(params.id)

  if (!sale) {
    notFound()
  }

  return (
    <html>
      <head>
        <title>Recibo - {sale.code}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          {`body { font-family: Arial, sans-serif; padding: 16px; color: #111 } .header{display:flex;justify-content:space-between;margin-bottom:12px} .items{width:100%;border-collapse:collapse} .items th,.items td{border-bottom:1px solid #ddd;padding:6px;text-align:left} .totals{margin-top:12px;text-align:right;font-weight:bold}`} 
        </style>
      </head>
      <body>
        <div className="header">
          <div>
            <div style={{ fontWeight: 700 }}>{sale.company?.name ?? 'Loja'}</div>
            <div style={{ fontSize: 12 }}>{sale.company?.cnpj ?? ''}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>Recibo</div>
            <div>{sale.code}</div>
            <div style={{ fontSize: 12 }}>{new Date(sale.createdAt).toLocaleString('pt-BR')}</div>
          </div>
        </div>

        <div>
          <table className="items">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Qtd</th>
                <th>Unit.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item: any) => (
                <tr key={item.id}>
                  <td>{item.productName}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unitPrice.toFixed(2)}</td>
                  <td>{item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals">Total: R$ {sale.total.toFixed(2)}</div>

          <div style={{ marginTop: 16 }}>
            <div>Forma de pagamento: {sale.paymentMethod ?? 'Não informado'}</div>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            const params = new URLSearchParams(location.search)
            const auto = params.get('autoPrint')
            if (auto === '1') {
              setTimeout(() => { try{ window.print(); }catch(e){} }, 600)
            }
          })()
        `}} />
      </body>
    </html>
  )
}
