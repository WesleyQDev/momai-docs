import oficioImg from '../../assets/cards/oficio.jpg'
import abntImg from '../../assets/cards/abnt.jpg'
import pptxImg from '../../assets/cards/pptx.jpg'
import apostilaImg from '../../assets/cards/apostila.jpg'
import podcastImg from '../../assets/cards/podcast.jpg'
import xlsxImg from '../../assets/cards/xlsx.jpg'
import reportImg from '../../assets/cards/report.jpg'
import letterheadImg from '../../assets/cards/letterhead.jpg'
import videoImg from '../../assets/cards/video.jpg'
import flashcardsImg from '../../assets/cards/flashcards.jpg'
import mindmapImg from '../../assets/cards/mindmap.jpg'
import resumeImg from '../../assets/cards/resume.jpg'
import lessonPlanImg from '../../assets/cards/lesson_plan.jpg'
import meetingMinutesImg from '../../assets/cards/meeting_minutes.jpg'

const CARD_IMAGES: Record<string, string> = {
  oficio: oficioImg,
  abnt: abntImg,
  pptx: pptxImg,
  apostila: apostilaImg,
  podcast: podcastImg,
  xlsx: xlsxImg,
  report: reportImg,
  letterhead: letterheadImg,
  video: videoImg,
  flashcards: flashcardsImg,
  mindmap: mindmapImg,
  resume: resumeImg,
  lesson_plan: lessonPlanImg,
  meeting_minutes: meetingMinutesImg
}

export function getModelCardBackground(toolId: string): string {
  return CARD_IMAGES[toolId] || oficioImg
}
