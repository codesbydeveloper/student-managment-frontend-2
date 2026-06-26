import { NavIconTile } from '../icons/NavIcon'

/** Sidebar nav icon — same image as dashboard / page headers. */
export function SidebarMenuIcon({ menuKey, groupKey, isActive = false, item }) {
  return (
    <NavIconTile
      navKey={menuKey}
      groupKey={groupKey}
      isActive={isActive}
      size="md"
      menuItem={item}
      variant="sidebar"
    />
  )
}
