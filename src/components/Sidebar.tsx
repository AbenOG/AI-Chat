import { useState } from 'react'
import { Plus, Settings, PanelLeftOpen, LogOut, MoreVertical, Edit, Trash2, Check, X, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import type { Chat } from '@/types'

interface SidebarProps {
  chats?: Chat[]
  onNewChat?: (incognito?: boolean) => void
  onSelectChat?: (chatId: string) => void
  activeChatId?: string
  onOpenSettings?: () => void
  onRenameChat?: (chatId: string, newTitle: string) => void
  onDeleteChat?: (chatId: string) => void
}

export function Sidebar({
  chats = [],
  onNewChat,
  onSelectChat,
  activeChatId,
  onOpenSettings,
  onRenameChat,
  onDeleteChat
}: SidebarProps) {
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
      // Auth context will handle navigation
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const startRename = (chat: Chat) => {
    setEditingChatId(chat.id)
    setEditingTitle(chat.title)
    setMenuOpenFor(null)
  }

  const saveRename = () => {
    if (editingChatId && editingTitle.trim() && onRenameChat) {
      onRenameChat(editingChatId, editingTitle.trim())
    }
    setEditingChatId(null)
    setEditingTitle('')
  }

  const cancelRename = () => {
    setEditingChatId(null)
    setEditingTitle('')
  }

  const handleDelete = (chatId: string) => {
    if (onDeleteChat) {
      onDeleteChat(chatId)
    }
    setMenuOpenFor(null)
  }

  // Filter chats based on search query
  const filteredChats = searchQuery.trim()
    ? chats.filter(chat =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chats

  const recentChats = filteredChats.filter(chat =>
    new Date(chat.updatedAt).getTime() > Date.now() - 1000 * 60 * 60 * 24 * 7
  )
  const earlierChats = filteredChats.filter(chat =>
    new Date(chat.updatedAt).getTime() <= Date.now() - 1000 * 60 * 60 * 24 * 7
  )

  return (
    <>
      {/* Hover Trigger Area */}
      <div
        className="fixed left-0 top-0 w-12 h-full z-40"
        onMouseEnter={() => setIsExpanded(true)}
      />

      {/* Collapsed Tab */}
      {!isExpanded && (
        <div
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30"
          onMouseEnter={() => setIsExpanded(true)}
        >
          <button
            className="
              flex items-center gap-2 px-3 py-4 rounded-r-xl
              bg-gradient-to-br from-white/[0.12] to-white/[0.06]
              backdrop-blur-xl backdrop-saturate-150
              border-r border-t border-b border-white/20
              text-muted-foreground hover:text-foreground
              shadow-[0_4px_16px_rgba(0,0,0,0.1),0_0_1px_rgba(255,255,255,0.3)_inset]
              transition-all duration-200
            "
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen
          bg-background
          border-r border-white/20
          flex-shrink-0 z-50
          mobile-sidebar-hidden
          transition-all duration-300 ease-out
          ${isExpanded ? 'w-80 translate-x-0' : 'w-80 -translate-x-full'}
          shadow-[0_8px_32px_rgba(0,0,0,0.3)]
        `}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-base font-semibold text-foreground mb-3">History</h2>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="
                  w-full pl-9 pr-3 py-2
                  bg-white/5 border border-white/10 rounded-lg
                  text-sm text-foreground placeholder:text-muted-foreground/40
                  focus:outline-none focus:border-white/20 focus:bg-white/8
                  transition-colors
                "
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded text-muted-foreground/60 hover:text-muted-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-4 pt-2">
            {/* No Results Message */}
            {searchQuery && recentChats.length === 0 && earlierChats.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <Search className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground/60 text-center">
                  No conversations found
                </p>
                <p className="text-xs text-muted-foreground/40 text-center mt-1">
                  Try a different search term
                </p>
              </div>
            )}

            {/* Recent Chats */}
            {recentChats.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
                  Recent
                </h3>
                <div className="space-y-1">
                  {recentChats.map(chat => (
                    <div
                      key={chat.id}
                      className={`
                        relative group rounded-xl mb-2
                        ${activeChatId === chat.id
                          ? 'bg-white/10 border border-white/20'
                          : 'hover:bg-white/5 border border-transparent'
                        }
                      `}
                    >
                      {editingChatId === chat.id ? (
                        <div className="p-2.5 flex items-center gap-2">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveRename()
                              if (e.key === 'Escape') cancelRename()
                            }}
                            className="flex-1 px-2 py-1 text-sm bg-white/5 border border-white/20 rounded focus:outline-none focus:border-white/40 text-foreground"
                            autoFocus
                          />
                          <button
                            onClick={saveRename}
                            className="p-1 hover:bg-white/10 rounded text-green-400"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelRename}
                            className="p-1 hover:bg-white/10 rounded text-red-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                       ) : (
                         <>
                           <button
                             onClick={() => onSelectChat?.(chat.id)}
                             className={`
                               w-full text-left p-3 pr-10 flex items-start
                               ${activeChatId === chat.id ? 'text-white' : 'text-foreground/90'}
                             `}
                           >
                             <div className="flex-1 min-w-0">
                               <div className={`
                                 text-sm truncate font-medium leading-tight
                                 ${activeChatId === chat.id ? 'text-white' : ''}
                               `}>
                                 {chat.title}
                               </div>
                               <div className={`
                                 text-xs mt-1
                                 ${activeChatId === chat.id
                                   ? 'text-white/60'
                                   : 'text-muted-foreground/50'
                                 }
                               `}>
                                 {new Date(chat.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                               </div>
                             </div>
                           </button>
                           <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation()
                                 setMenuOpenFor(menuOpenFor === chat.id ? null : chat.id)
                               }}
                               className="p-1.5 hover:bg-white/10 rounded text-muted-foreground hover:text-foreground"
                             >
                               <MoreVertical className="w-3.5 h-3.5" />
                             </button>
                             {menuOpenFor === chat.id && (
                               <div className="absolute right-0 top-full mt-1 bg-background border border-white/20 rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation()
                                     startRename(chat)
                                   }}
                                   className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/8 text-foreground/90 hover:text-foreground"
                                 >
                                   <Edit className="w-3.5 h-3.5" />
                                   Rename
                                 </button>
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation()
                                     handleDelete(chat.id)
                                   }}
                                   className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-500/10 text-red-400 hover:text-red-300"
                                 >
                                   <Trash2 className="w-3.5 h-3.5" />
                                   Delete
                                 </button>
                               </div>
                             )}
                           </div>
                         </>
                       )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Earlier Chats - Same as Recent */}
            {earlierChats.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
                  Earlier
                </h3>
                <div className="space-y-1">
                  {earlierChats.map(chat => (
                    <div
                      key={chat.id}
                      className={`
                        relative group rounded-xl mb-2
                        ${activeChatId === chat.id
                          ? 'bg-white/10 border border-white/20'
                          : 'hover:bg-white/5 border border-transparent'
                        }
                      `}
                    >
                      {editingChatId === chat.id ? (
                        <div className="p-2.5 flex items-center gap-2">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveRename()
                              if (e.key === 'Escape') cancelRename()
                            }}
                            className="flex-1 px-2 py-1 text-sm bg-white/5 border border-white/20 rounded focus:outline-none focus:border-white/40 text-foreground"
                            autoFocus
                          />
                          <button
                            onClick={saveRename}
                            className="p-1 hover:bg-white/10 rounded text-green-400"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelRename}
                            className="p-1 hover:bg-white/10 rounded text-red-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                       ) : (
                         <>
                           <button
                             onClick={() => onSelectChat?.(chat.id)}
                             className={`
                               w-full text-left p-3 pr-10 flex items-start
                               ${activeChatId === chat.id ? 'text-white' : 'text-foreground/90'}
                             `}
                           >
                             <div className="flex-1 min-w-0">
                               <div className={`
                                 text-sm truncate font-medium leading-tight
                                 ${activeChatId === chat.id ? 'text-white' : ''}
                               `}>
                                 {chat.title}
                               </div>
                               <div className={`
                                 text-xs mt-1
                                 ${activeChatId === chat.id
                                   ? 'text-white/60'
                                   : 'text-muted-foreground/50'
                                 }
                               `}>
                                 {new Date(chat.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                               </div>
                             </div>
                           </button>
                           <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation()
                                 setMenuOpenFor(menuOpenFor === chat.id ? null : chat.id)
                               }}
                               className="p-1.5 hover:bg-white/10 rounded text-muted-foreground hover:text-foreground"
                             >
                               <MoreVertical className="w-3.5 h-3.5" />
                             </button>
                             {menuOpenFor === chat.id && (
                               <div className="absolute right-0 top-full mt-1 bg-background border border-white/20 rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation()
                                     startRename(chat)
                                   }}
                                   className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/8 text-foreground/90 hover:text-foreground"
                                 >
                                   <Edit className="w-3.5 h-3.5" />
                                   Rename
                                 </button>
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation()
                                     handleDelete(chat.id)
                                   }}
                                   className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-500/10 text-red-400 hover:text-red-300"
                                 >
                                   <Trash2 className="w-3.5 h-3.5" />
                                   Delete
                                 </button>
                               </div>
                             )}
                           </div>
                         </>
                       )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="p-3 space-y-2 border-t border-white/10 bg-black/5">
            {/* User Info */}
            {user && (
              <div className="px-3 py-2 mb-2 rounded-lg bg-white/[0.05] border border-white/10">
                <p className="text-xs text-muted-foreground/60 mb-0.5">Signed in as</p>
                <p className="text-sm text-foreground font-medium truncate">{user.username}</p>
              </div>
            )}

            {/* Settings Pill */}
            <button
              onClick={onOpenSettings}
              className="
                w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg
                bg-gradient-to-br from-white/[0.10] to-white/[0.05]
                backdrop-blur-xl backdrop-saturate-150
                border border-white/20
                hover:from-white/[0.15] hover:to-white/[0.08] hover:border-white/30
                text-foreground/90 hover:text-foreground
                shadow-[0_2px_8px_rgba(0,0,0,0.1),0_0_1px_rgba(255,255,255,0.3)_inset]
                transition-all duration-200
                group
              "
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Settings</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="
                w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg
                bg-gradient-to-br from-white/[0.10] to-white/[0.05]
                backdrop-blur-xl backdrop-saturate-150
                border border-white/20
                hover:from-red-500/[0.15] hover:to-red-500/[0.08]
                hover:border-red-500/30
                text-foreground/90 hover:text-red-400
                shadow-[0_2px_8px_rgba(0,0,0,0.1),0_0_1px_rgba(255,255,255,0.3)_inset]
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                group
              "
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </span>
            </button>

            {/* New Chat Button */}
            <button
              onClick={() => onNewChat?.(false)}
              className="
                w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                bg-gradient-to-br from-white/95 to-white/85
                hover:from-white hover:to-white/95
                backdrop-blur-xl
                border border-white/50
                text-background
                font-medium text-sm
                shadow-[0_4px_16px_rgba(255,255,255,0.3),0_0_1px_rgba(255,255,255,0.4)_inset]
                hover:shadow-[0_6px_20px_rgba(255,255,255,0.4),0_0_2px_rgba(255,255,255,0.5)_inset]
                transition-all duration-200
              "
              aria-label="New chat"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}