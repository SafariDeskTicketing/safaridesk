import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import React, { useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setResizableImage: (options: {
        src: string;
        alt?: string;
        title?: string;
        width?: number;
      }) => ReturnType;
    };
  }
}

// React component for the resizable image
const ResizableImageComponent = ({ node, updateAttributes }: any) => {
  const [isResizing, setIsResizing] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startWidth, setStartWidth] = useState(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    setStartX(e.clientX)
    setStartWidth(node.attrs.width || 300)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return
    
    const diff = e.clientX - startX
    const newWidth = Math.max(100, Math.min(800, startWidth + diff))
    updateAttributes({ width: newWidth })
  }

  const handleMouseUp = () => {
    setIsResizing(false)
  }

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing, startX, startWidth])

  return (
    <NodeViewWrapper className="resizable-image-wrapper">
      <div 
        className="resizable-image-container"
        style={{ 
          width: node.attrs.width || 300,
          position: 'relative',
          display: 'inline-block'
        }}
      >
        <img
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block'
          }}
        />
        <div
          className="resize-handle"
          style={{
            position: 'absolute',
            right: '-6px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '10px',
            height: '20px',
            backgroundColor: '#20b8cd',
            cursor: 'ew-resize',
            borderRadius: '2px'
          }}
          onMouseDown={handleMouseDown}
        />
      </div>
    </NodeViewWrapper>
  )
}

// TipTap extension definition
export const ResizableImage = Node.create({
  name: 'resizableImage',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: 300,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (element) => {
          const img = element as HTMLImageElement
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
            title: img.getAttribute('title'),
            width: parseInt(img.getAttribute('width') || '300', 10),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent)
  },

  addCommands() {
    return {
      setResizableImage: (options: any) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        })
      },
    } as any
  },
})

export default ResizableImage
