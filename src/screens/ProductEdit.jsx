import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { parseAmount } from '../lib/format.js'
import { addStock } from '../lib/shop.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'

// /shop/new = a new product, /shop/12 = edit product 12.
export default function ProductEdit() {
  const { id } = useParams()
  const result = useLoad(
    () => (id ? unwrap(supabase.from('products').select('*').eq('id', id).single()) : Promise.resolve(null)),
    [id],
  )

  return (
    <main className="screen">
      <Link to="/shop" className="back-link">‹ Tienda</Link>
      {id ? (
        <>
          <LoadState {...result} />
          {result.data && <EditProduct product={result.data} reload={result.reload} />}
        </>
      ) : (
        <NewProduct />
      )}
    </main>
  )
}

function NewProduct() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const amount = parseAmount(price)
    if (amount === null) return setError('Escribí el precio, por ejemplo 1500.')
    setBusy(true)
    try {
      // The first stock is saved with the product; after that, stock only
      // changes through sales and "Llegó mercadería".
      await unwrap(supabase.from('products').insert({ name: name.trim(), price: amount, stock: Number(stock) || 0 }))
      showToast(`${name.trim()} agregado`)
      navigate('/shop', { replace: true })
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <>
      <h1>Nuevo producto</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Agua 500 ml" required />
        </label>
        <label>
          Precio
          <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="ej. 1500" required />
        </label>
        <label>
          ¿Cuántos tenés ahora?
          <input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} placeholder="ej. 24" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Agregar producto'}</button>
      </form>
    </>
  )
}

function EditProduct({ product, reload }) {
  const showToast = useToast()
  const [name, setName] = useState(product.name)
  const [price, setPrice] = useState(String(product.price))
  const [error, setError] = useState('')

  async function run(action, message, onUndo) {
    setError('')
    try {
      await action()
      reload()
      showToast(message, onUndo)
      return true
    } catch (err) {
      setError(saveErrorMessage(err))
      return false
    }
  }

  function saveDetails(e) {
    e.preventDefault()
    const amount = parseAmount(price)
    if (amount === null) return setError('Escribí el precio, por ejemplo 1500.')
    // Past sales keep the price they were sold at (saved on each sale).
    run(() => unwrap(supabase.from('products').update({ name: name.trim(), price: amount }).eq('id', product.id)), 'Guardado')
  }

  function toggleActive() {
    const setActive = (active) => unwrap(supabase.from('products').update({ active }).eq('id', product.id))
    run(
      () => setActive(!product.active),
      product.active ? `${product.name} ya no se muestra en la tienda` : `${product.name} vuelve a la tienda`,
      () => run(() => setActive(product.active), 'Cambio deshecho'),
    )
  }

  return (
    <>
      <h1>
        {product.name}
        {!product.active && <span className="badge">No se vende</span>}
      </h1>

      <section className="section">
        <h2>Stock</h2>
        <p className={`big-number ${product.stock <= 0 ? 'error' : ''}`}>
          {product.stock} <span className="muted">{product.stock === 1 ? 'unidad' : 'unidades'}</span>
        </p>
        <StockForms product={product} run={run} />
      </section>

      <section className="section">
        <h2>Nombre y precio</h2>
        <form onSubmit={saveDetails}>
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Precio
            <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </label>
          <p className="muted">Las ventas anteriores quedan con el precio de ese momento.</p>
          <button className="btn-secondary">Guardar cambios</button>
        </form>
      </section>

      <section className="section">
        {product.active && <p className="muted">Si dejás de vender este producto, sacalo de la tienda. Sus ventas se guardan.</p>}
        <button className="btn-secondary" onClick={toggleActive}>
          {product.active ? 'Sacar de la tienda' : 'Volver a venderlo'}
        </button>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
    </>
  )
}

// Two ways to change stock: "Llegó mercadería" (+ how many arrived) and
// "Corregir" (type the real count, e.g. after counting the fridge).
function StockForms({ product, run }) {
  const [mode, setMode] = useState(null) // null, 'add' or 'fix'
  const [value, setValue] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const n = Number(value)
    if (!value || Number.isNaN(n)) return
    // add_stock adds (or takes away) a difference, so a correction sends
    // "real count − what the app thinks".
    const change = mode === 'add' ? n : n - product.stock
    const message = mode === 'add' ? `+${n} ${product.name}` : `Stock corregido: ${n}`
    const ok = await run(() => addStock(product.id, change), message, () =>
      run(() => addStock(product.id, -change), 'Cambio deshecho'),
    )
    if (ok) {
      setMode(null)
      setValue('')
    }
  }

  if (mode === null) {
    return (
      <div className="stack">
        <button className="btn-primary" onClick={() => setMode('add')}>Llegó mercadería</button>
        <button className="btn-secondary" onClick={() => setMode('fix')}>Corregir el stock</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="slot-box">
      <label>
        {mode === 'add' ? '¿Cuántos llegaron?' : '¿Cuántos hay de verdad?'}
        <input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} autoFocus required />
      </label>
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={() => setMode(null)}>Cancelar</button>
        <button className="btn-primary">Guardar</button>
      </div>
    </form>
  )
}
