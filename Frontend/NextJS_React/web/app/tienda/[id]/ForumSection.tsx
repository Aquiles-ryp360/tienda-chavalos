'use client'

import { useEffect, useState } from 'react'
import styles from '../tienda.module.css'

interface Post {
  id:         string
  authorName: string
  content:    string
  createdAt:  string
}

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'hace un momento'
  if (mins < 60)  return `hace ${mins} min`
  if (hours < 24) return `hace ${hours}h`
  if (days < 7)   return `hace ${days} días`
  return new Date(dateStr).toLocaleDateString('es-NI', { day: 'numeric', month: 'short', year: 'numeric' })
}

function avatarInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

export function ForumSection({ productId }: { productId: string }) {
  const [posts,   setPosts]   = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error,   setError]   = useState('')

  const [nickname, setNickname] = useState('')
  const [content,  setContent]  = useState('')

  // Recuperar apodo del localStorage
  useEffect(() => {
    const saved = localStorage.getItem('fc_nickname')
    if (saved) setNickname(saved)
  }, [])

  // Cargar posts
  useEffect(() => {
    setLoading(true)
    fetch(`/api/public/productos/${productId}/foro`)
      .then(r => r.json())
      .then(d => setPosts(d.posts ?? []))
      .catch(() => setError('No se pudieron cargar los comentarios.'))
      .finally(() => setLoading(false))
  }, [productId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimNick    = nickname.trim()
    const trimContent = content.trim()

    if (trimNick.length < 2) { setError('El apodo debe tener al menos 2 caracteres.'); return }
    if (trimContent.length < 5) { setError('El mensaje debe tener al menos 5 caracteres.'); return }

    setPosting(true)
    try {
      const res = await fetch(`/api/public/productos/${productId}/foro`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ authorName: trimNick, content: trimContent }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al publicar el mensaje.')
        return
      }

      // Guardar apodo para la próxima vez
      localStorage.setItem('fc_nickname', trimNick)

      // Agregar el nuevo post al inicio de la lista
      setPosts(prev => [data.post, ...prev])
      setContent('')
    } catch {
      setError('Error de red. Inténtalo de nuevo.')
    } finally {
      setPosting(false)
    }
  }

  return (
    <section className={styles.forumSection}>
      <div className={styles.forumHeader}>
        <h2 className={styles.forumTitle}>💬 Comentarios y preguntas</h2>
        {!loading && (
          <span className={styles.forumCount}>{posts.length}</span>
        )}
      </div>

      {/* Formulario para nuevo comentario */}
      <form onSubmit={handleSubmit} className={styles.forumForm}>
        <div className={styles.forumFormRow}>
          <input
            className={styles.forumInput}
            type="text"
            placeholder="Tu apodo (ej: Marcos, Cliente01…)"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            maxLength={30}
            required
          />
        </div>
        <textarea
          className={styles.forumTextarea}
          placeholder="Escribe un comentario, pregunta o reseña sobre este producto…"
          value={content}
          onChange={e => setContent(e.target.value)}
          maxLength={500}
          required
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {content.length}/500
          </span>
          <button type="submit" className={styles.forumSubmit} disabled={posting}>
            {posting ? 'Publicando…' : 'Publicar comentario'}
          </button>
        </div>
      </form>

      {error && <p className={styles.forumError}>{error}</p>}

      {/* Lista de posts */}
      <div className={styles.forumPosts}>
        {loading ? (
          <p className={styles.forumLoading}>Cargando comentarios…</p>
        ) : posts.length === 0 ? (
          <p className={styles.forumEmpty}>
            Aún no hay comentarios. ¡Sé el primero en preguntar o dejar tu opinión!
          </p>
        ) : (
          posts.map(post => (
            <article key={post.id} className={styles.forumPost}>
              <div className={styles.forumPostMeta}>
                <div className={styles.forumPostAvatar}>
                  {avatarInitials(post.authorName)}
                </div>
                <span className={styles.forumPostAuthor}>{post.authorName}</span>
                <time className={styles.forumPostTime} dateTime={post.createdAt}>
                  {timeAgo(post.createdAt)}
                </time>
              </div>
              <p className={styles.forumPostContent}>{post.content}</p>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
