import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"

const sloganKeys = ["1", "2", "3", "4", "5", "6", "7", "8"]

export function DynamicSlogan() {
    const { t } = useTranslation()
    const [currentSlogan, setCurrentSlogan] = useState(0)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)

        const interval = setInterval(() => {
            setCurrentSlogan((prev) => (prev + 1) % sloganKeys.length)
        }, 20000)

        return () => clearInterval(interval)
    }, [])

    return (
        <h2 className="text-3xl sm:text-10xl font-bold bg-gradient-to-r from-white to-white bg-clip-text text-transparent mb-2 font-serif uppercase">
            {t(`home.slogans.${sloganKeys[currentSlogan]}`)}
        </h2>
    )
}
