<script>
  import {
    ImageDown,
    Image,
    Settings,
    Play,
    Eye,
    Hand,
    Route,
    ClipboardCheck,
    Zap,
    Wrench,
    ImagePlus,
    LayoutTemplate,
    CircleHelp,
    Undo2,
    Redo2,
    Plus,
    Copy,
    Trash2,
    Link,
    Megaphone,
    RotateCcw,
    Crosshair,
    Palette,
    Check,
    AlertTriangle,
    Maximize,
    Radio,
    FileText,
    FileUp,
    Download,
    FolderOpen,
    Search,
    Sliders,
    CircleSlash,
    Ban,
    ArrowRight,
    Unlink,
    Pencil,
    Sun,
    Sunset,
    Moon,
    Volume2,
    Volume1,
    VolumeX,
    Clock,
    Sparkles,
    Archive,
    Music,
    Cloud,
    Eraser,
    Info,
  } from '@lucide/svelte';

  const iconMap = {
    'image-down': ImageDown,
    'png': ImageDown,
    'image': Image,
    'backgrounds': Image,
    'settings': Settings,
    'play': Play,
    'test': Play,
    'eye': Eye,
    'view': Eye,
    'hand': Hand,
    'pan': Hand,
    'route': Route,
    'clipboard-check': ClipboardCheck,
    'audit': ClipboardCheck,
    'zap': Zap,
    'essentials': Zap,
    'wrench': Wrench,
    'full-spec': Wrench,
    'image-plus': ImagePlus,
    'open-bg': ImagePlus,
    'layout-template': LayoutTemplate,
    'templates': LayoutTemplate,
    'circle-help': CircleHelp,
    'help': CircleHelp,
    'undo': Undo2,
    'redo': Redo2,
    'plus': Plus,
    'copy': Copy,
    'duplicate': Copy,
    'trash': Trash2,
    'delete': Trash2,
    'link': Link,
    'reachable': Link,
    'megaphone': Megaphone,
    'scream': Megaphone,
    'reset': RotateCcw,
    'rotate-ccw': RotateCcw,
    'center': Crosshair,
    'crosshair': Crosshair,
    'palette': Palette,
    'check': Check,
    'alert': AlertTriangle,
    'alert-triangle': AlertTriangle,
    'fit': Maximize,
    'maximize': Maximize,
    'radar': Radio,
    'radio': Radio,
    'file-text': FileText,
    'file-up': FileUp,
    'download': Download,
    'folder': FolderOpen,
    'search': Search,
    'sliders': Sliders,
    'circle-slash': CircleSlash,
    'ban': Ban,
    'arrow-right': ArrowRight,
    'unlink': Unlink,
    'pencil': Pencil,
    'edit': Pencil,
    'sun': Sun,
    'sunset': Sunset,
    'moon': Moon,
    'volume-2': Volume2,
    'volume-1': Volume1,
    'volume-x': VolumeX,
    'clock': Clock,
    'sparkles': Sparkles,
    'archive': Archive,
    'music': Music,
    'cloud': Cloud,
    'eraser': Eraser,
    'info': Info,
  };

  export let name = '';
  $: Comp = iconMap[name] || null;
</script>

<span class="lucide-box" aria-hidden="true">
  {#if Comp}
    <svelte:component this={Comp} size={16} strokeWidth={1.5} />
  {/if}
</span>

<style>
  .lucide-box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    min-width: 16px;
    min-height: 16px;
    vertical-align: -2px;
    flex: none;
    line-height: 1;
    color: currentColor;
  }
  :global(.lucide-box > svg) {
    width: 16px !important;
    height: 16px !important;
    stroke-width: 1.5px !important;
    stroke: currentColor !important;
    display: block;
    flex: none;
  }
</style>
