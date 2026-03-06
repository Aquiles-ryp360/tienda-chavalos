import React from 'react'
import styles from './card.module.css'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return <div className={`${styles.card} ${className || ''}`}>{children}</div>
}

interface CardHeaderProps {
  children: React.ReactNode
}

export function CardHeader({ children }: CardHeaderProps) {
  return <div className={styles.header}>{children}</div>
}

interface CardTitleProps {
  children: React.ReactNode
}

export function CardTitle({ children }: CardTitleProps) {
  return <h3 className={styles.title}>{children}</h3>
}

interface CardBodyProps {
  children: React.ReactNode
}

export function CardBody({ children }: CardBodyProps) {
  return <div className={styles.body}>{children}</div>
}

interface CardFooterProps {
  children: React.ReactNode
}

export function CardFooter({ children }: CardFooterProps) {
  return <div className={styles.footer}>{children}</div>
}
