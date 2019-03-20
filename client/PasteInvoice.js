/** @format */

import React, {useEffect} from 'react'

export default function PasteInvoice({onPasted, hide, maximum}) {
  function handlePasted(e) {
    e.preventDefault()
    onPasted(e.target.invoice.value)
  }

  function stopShowing(e) {
    e.preventDefault()
    hide()
  }

  useEffect(() => {
    try {
      window.webln
        .makeInvoice({
          maximumAmount: maximum,
          defaultAmount: maximum,
          defaultMemo: 'withdraw from satoshi-go-bet'
        })
        .then(({paymentRequest: invoice}) => {
          onPasted(invoice)
        })
    } catch (e) {}
  }, [])

  return (
    <div id="paste-invoice">
      <p>Paste your invoice here:</p>
      <form onSubmit={handlePasted}>
        <textarea name="invoice" />
        <div className="controls">
          <a onClick={stopShowing}>Cancel</a>
          <button>Pasted!</button>
        </div>
      </form>
    </div>
  )
}
