import React from "react"
import { OwidArticleType, OwidArticleErrorMessage } from "@ourworldindata/utils"
import { ExcerptHandler } from "./gdocsValidation.js"
import { GdocsSlug } from "./GdocsSlug.js"
import {
    GdocsSettingsContentField,
    GdocsSettingsTextArea,
} from "./GdocsSettingsContentField.js"
import { GdocsDateline } from "./GdocsDateline.js"
import { GdocsPublicationContext } from "./GdocsPublicationContext.js"

export const GdocsSettingsForm = ({
    gdoc,
    setGdoc,
    errors,
}: {
    gdoc: OwidArticleType
    setGdoc: (gdoc: OwidArticleType) => void
    errors?: OwidArticleErrorMessage[]
}) => {
    return gdoc ? (
        <form className="GdocsSettingsForm">
            <GdocsSettingsContentField
                property="title"
                gdoc={gdoc}
                errors={errors}
            />
            <div className="form-group">
                <GdocsSlug gdoc={gdoc} setGdoc={setGdoc} errors={errors} />
            </div>
            <GdocsSettingsContentField
                property="byline"
                gdoc={gdoc}
                errors={errors}
            />
            <div className="form-group">
                <GdocsDateline gdoc={gdoc} setGdoc={setGdoc} errors={errors} />
            </div>
            <div className="form-group">
                <GdocsPublicationContext gdoc={gdoc} setGdoc={setGdoc} />
            </div>

            <GdocsSettingsContentField
                property="excerpt"
                gdoc={gdoc}
                errors={errors}
                render={(props) => (
                    <GdocsSettingsTextArea
                        {...props}
                        inputProps={{
                            showCount: true,
                            maxLength: ExcerptHandler.maxLength,
                        }}
                    />
                )}
            />
            <div className="form-group">
                <p>Document errors</p>
                <ul>
                    {errors?.map((error) => (
                        <li key={error.message}>{error.message}</li>
                    ))}
                </ul>
            </div>
        </form>
    ) : null
}
